import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";

describe("health endpoint", () => {
  test("returns OK", async () => {
    const app = createApp();

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });
});
