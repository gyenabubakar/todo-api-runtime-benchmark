import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// Custom metrics
const authRegister = new Counter("auth_register");
const authLogin = new Counter("auth_login");
const todoList = new Counter("todo_list");
const todoCreate = new Counter("todo_create");
const todoGet = new Counter("todo_get");
const todoUpdate = new Counter("todo_update");
const todoDelete = new Counter("todo_delete");

const registerLatency = new Trend("register_latency");
const loginLatency = new Trend("login_latency");
const listLatency = new Trend("list_latency");
const createLatency = new Trend("create_latency");
const getLatency = new Trend("get_latency");
const updateLatency = new Trend("update_latency");
const deleteLatency = new Trend("delete_latency");

const peakVUs = parseInt(__ENV.PEAK_VUS, 10) || 1000;
const durationMultiplier = peakVUs <= 1000 ? 1 : 1 + (peakVUs / 1000 - 1) * 0.5;

// Base durations in seconds
const baseDurations = [30, 60, 60, 30, 60]; // warm-up, main, stress, peak, ramp-down
const baseTargets = [0.1, 0.2, 0.5, 1, 0];

const stages = baseDurations.map((baseDuration, i) => ({
  duration: `${Math.round(baseDuration * durationMultiplier)}s`,
  target: Math.round(baseTargets[i] * peakVUs),
}));

export const options = {
  scenarios: {
    default: {
      executor: "ramping-vus",
      stages,
      gracefulRampDown: "30s",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:8080";
const RESULT_PATH = __ENV.RESULT_PATH;

const params = {
  headers: { "Content-Type": "application/json" },
  timeout: "10s",
};

function authParams(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    timeout: "10s",
  };
}

export default function () {
  const uniqueId = `${Date.now()}-${__VU}-${__ITER}`;
  const email = `bench-${uniqueId}@test.com`;
  const password = "password123";

  // 1. Register
  const regStart = Date.now();
  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password, name: "Benchmark User" }),
    params,
  );
  registerLatency.add(Date.now() - regStart);

  const regOk = check(registerRes, {
    "register status 201": (r) => r.status === 201,
  });
  if (regOk) authRegister.add(1);

  if (registerRes.status !== 201) {
    sleep(3);
    return;
  }

  const token = registerRes.json("token");

  // 2. Login
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    params,
  );
  loginLatency.add(Date.now() - loginStart);

  const loginOk = check(loginRes, {
    "login status 200": (r) => r.status === 200,
  });
  if (loginOk) authLogin.add(1);

  // 3. List todos (empty)
  const listStart = Date.now();
  const listRes = http.get(`${BASE_URL}/todos`, authParams(token));
  listLatency.add(Date.now() - listStart);

  const listOk = check(listRes, {
    "list status 200": (r) => r.status === 200,
  });
  if (listOk) todoList.add(1);

  // 4. Create todo
  const createStart = Date.now();
  const createRes = http.post(
    `${BASE_URL}/todos`,
    JSON.stringify({ title: `Task ${uniqueId}`, order: 1 }),
    authParams(token),
  );
  createLatency.add(Date.now() - createStart);

  const createOk = check(createRes, {
    "create status 201": (r) => r.status === 201,
  });
  if (createOk) todoCreate.add(1);

  if (createRes.status !== 201) {
    sleep(3);
    return;
  }

  const todoId = createRes.json("id");

  // 5. Get todo (cache miss - first read)
  const getStart = Date.now();
  const getRes = http.get(`${BASE_URL}/todos/${todoId}`, {
    ...authParams(token),
    tags: { name: "GET /todos/:id" },
  });
  getLatency.add(Date.now() - getStart);

  const getOk = check(getRes, {
    "get status 200": (r) => r.status === 200,
  });
  if (getOk) todoGet.add(1);

  // 6. Get todo again (cache hit)
  for (let i = 0; i < 2; i++) {
    const cacheHitStart = Date.now();
    const cacheHitRes = http.get(`${BASE_URL}/todos/${todoId}`, {
      ...authParams(token),
      tags: { name: "GET /todos/:id" },
    });
    getLatency.add(Date.now() - cacheHitStart);
    if (check(cacheHitRes, { "get status 200": (r) => r.status === 200 })) {
      todoGet.add(1);
    }
  }

  // 7. List todos (cache hit after create)
  const listStart2 = Date.now();
  const listRes2 = http.get(`${BASE_URL}/todos`, authParams(token));
  listLatency.add(Date.now() - listStart2);
  if (check(listRes2, { "list status 200": (r) => r.status === 200 })) {
    todoList.add(1);
  }

  // 8. Update todo (invalidates cache)
  const updateStart = Date.now();
  const updateRes = http.patch(
    `${BASE_URL}/todos/${todoId}`,
    JSON.stringify({ title: "Updated Task", completed: true }),
    { ...authParams(token), tags: { name: "PATCH /todos/:id" } },
  );
  updateLatency.add(Date.now() - updateStart);

  const updateOk = check(updateRes, {
    "update status 200": (r) => r.status === 200,
  });
  if (updateOk) todoUpdate.add(1);

  // 9. Get todo after update (cache miss)
  const getAfterUpdateStart = Date.now();
  const getAfterUpdateRes = http.get(`${BASE_URL}/todos/${todoId}`, {
    ...authParams(token),
    tags: { name: "GET /todos/:id" },
  });
  getLatency.add(Date.now() - getAfterUpdateStart);
  if (check(getAfterUpdateRes, { "get status 200": (r) => r.status === 200 })) {
    todoGet.add(1);
  }

  // 10. Get todo again (cache hit after update)
  for (let i = 0; i < 2; i++) {
    const cacheHitStart = Date.now();
    const cacheHitRes = http.get(`${BASE_URL}/todos/${todoId}`, {
      ...authParams(token),
      tags: { name: "GET /todos/:id" },
    });
    getLatency.add(Date.now() - cacheHitStart);
    if (check(cacheHitRes, { "get status 200": (r) => r.status === 200 })) {
      todoGet.add(1);
    }
  }

  // 11. List todos after update (cache miss)
  const listStart3 = Date.now();
  const listRes3 = http.get(`${BASE_URL}/todos`, authParams(token));
  listLatency.add(Date.now() - listStart3);
  if (check(listRes3, { "list status 200": (r) => r.status === 200 })) {
    todoList.add(1);
  }

  // 12. Delete todo
  const deleteStart = Date.now();
  const deleteRes = http.del(`${BASE_URL}/todos/${todoId}`, null, {
    ...authParams(token),
    tags: { name: "DELETE /todos/:id" },
  });
  deleteLatency.add(Date.now() - deleteStart);

  const deleteOk = check(deleteRes, {
    "delete status 204": (r) => r.status === 204,
  });
  if (deleteOk) todoDelete.add(1);

  // Pause to simulate realistic user behavior
  sleep(3);
}

export function handleSummary(data) {
  if (!RESULT_PATH) {
    return {};
  }

  return {
    [RESULT_PATH]: JSON.stringify(
      {
        schemaVersion: 1,
        backend: __ENV.RESULT_BACKEND || "unknown",
        label: __ENV.RESULT_LABEL || String(peakVUs),
        peakVUs,
        apiUrl: BASE_URL,
        createdAt: __ENV.RESULT_CREATED_AT || new Date().toISOString(),
        summary: data,
      },
      null,
      2,
    ),
  };
}
