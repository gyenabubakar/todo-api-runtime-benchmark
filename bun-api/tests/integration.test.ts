import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import { createApp } from "../src/app";
import { closeDatabase, db } from "../src/db/client";
import { redisClient, todoCacheKey, todosCacheKey } from "../src/lib/cache";

const integrationTest = process.env.RUN_INTEGRATION_TESTS ? test : test.skip;
const app = createApp();

function request(path: string, init?: RequestInit) {
  return app.handle(new Request(`http://localhost${path}`, init));
}

async function parseJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function cleanupState() {
  await db.execute(sql`
    DELETE FROM todos
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE 'it-bun-api-%'
    )
  `);
  await db.execute(sql`
    DELETE FROM users
    WHERE email LIKE 'it-bun-api-%'
  `);
  await redisClient.send("FLUSHDB", []);
}

async function registerUser(suffix: string) {
  const response = await request("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: `it-bun-api-${suffix}@example.com`,
      password: "password123",
      name: "Integration Test"
    })
  });

  return {
    response,
    body: await parseJson<{
      token: string;
      user: {
        id: string;
        email: string;
      };
    }>(response)
  };
}

beforeEach(async () => {
  if (!process.env.RUN_INTEGRATION_TESTS) {
    return;
  }

  await cleanupState();
});

afterAll(async () => {
  if (process.env.RUN_INTEGRATION_TESTS) {
    await cleanupState();
  }

  redisClient.close();
  await closeDatabase();
});

describe("bun-api integration", () => {
  integrationTest("register/login success and failure", async () => {
    const register = await registerUser("auth");

    expect(register.response.status).toBe(201);
    expect(typeof register.body.token).toBe("string");

    const duplicate = await request("/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: register.body.user.email,
        password: "password123",
        name: "Duplicate"
      })
    });
    expect(duplicate.status).toBe(409);

    const login = await request("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: register.body.user.email,
        password: "password123"
      })
    });
    const loginBody = await parseJson<{ token: string; user: { id: string } }>(login);

    expect(login.status).toBe(200);
    expect(loginBody.user.id).toBe(register.body.user.id);

    const invalid = await request("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: register.body.user.email,
        password: "wrong-password"
      })
    });
    expect(invalid.status).toBe(401);
  });

  integrationTest("protected routes reject missing and invalid auth", async () => {
    const missing = await request("/todos");
    expect(missing.status).toBe(401);
    expect(await parseJson<{ error: string }>(missing)).toEqual({
      error: "Authorization header required"
    });

    const malformed = await request("/todos", {
      headers: {
        Authorization: "Token abc"
      }
    });
    expect(malformed.status).toBe(401);
    expect(await parseJson<{ error: string }>(malformed)).toEqual({
      error: "Invalid authorization header format"
    });

    const invalid = await request("/todos", {
      headers: {
        Authorization: "Bearer definitely-not-valid"
      }
    });
    expect(invalid.status).toBe(401);
    expect(await parseJson<{ error: string }>(invalid)).toEqual({
      error: "Invalid or expired token"
    });
  });

  integrationTest("todo CRUD and ordering work", async () => {
    const { body: auth } = await registerUser("todos");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`
    };

    await request("/todos", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "second", order: 2 })
    });
    await request("/todos", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "first", order: 1 })
    });
    await request("/todos", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "last" })
    });

    const list = await request("/todos", { headers });
    const todos = await parseJson<Array<{ id: string; title: string }>>(list);

    expect(list.status).toBe(200);
    expect(todos.map((todo) => todo.title)).toEqual(["first", "second", "last"]);

    const updated = await request(`/todos/${todos[0].id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "done", completed: true })
    });
    const updatedTodo = await parseJson<{
      id: string;
      title: string;
      completed: boolean;
      url: string;
      createdAt: string;
      updatedAt: string;
    }>(updated);

    expect(updated.status).toBe(200);
    expect(updatedTodo.title).toBe("done");
    expect(updatedTodo.completed).toBe(true);
    expect(updatedTodo.id).toBe(todos[0].id);
    expect(updatedTodo.url).toContain(`/todos/${todos[0].id}`);
    expect(typeof updatedTodo.createdAt).toBe("string");
    expect(typeof updatedTodo.updatedAt).toBe("string");

    const deleted = await request(`/todos/${todos[0].id}`, {
      method: "DELETE",
      headers
    });
    expect(deleted.status).toBe(204);

    const deleteAll = await request("/todos", {
      method: "DELETE",
      headers
    });
    expect(deleteAll.status).toBe(204);
  });

  integrationTest("cache keys are populated and invalidated", async () => {
    const { body: auth } = await registerUser("cache");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`
    };

    await request("/todos", { headers });

    const created = await request("/todos", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "cache", order: 1 })
    });
    const todo = await parseJson<{ id: string }>(created);

    await request(`/todos/${todo.id}`, { headers });
    await request(`/todos/${todo.id}`, { headers });
    await request("/todos", { headers });

    const userKey = todosCacheKey(auth.user.id);
    const itemKey = todoCacheKey(todo.id);

    expect(await redisClient.exists(userKey)).toBe(true);
    expect(await redisClient.exists(itemKey)).toBe(true);
    expect(await redisClient.ttl(userKey)).toBe(300);
    expect(await redisClient.ttl(itemKey)).toBe(300);

    const update = await request(`/todos/${todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ completed: true })
    });

    expect(update.status).toBe(200);
    expect(await redisClient.exists(userKey)).toBe(false);
    expect(await redisClient.exists(itemKey)).toBe(false);
  });
});
