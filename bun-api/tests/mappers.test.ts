import { describe, expect, test } from "bun:test";

import type { TodoRow, UserRow } from "../src/db/schema";
import { toTodoResponse, toUserResponse } from "../src/lib/mappers";

describe("response mappers", () => {
  test("maps users with camelCase timestamps", () => {
    const user: UserRow = {
      id: crypto.randomUUID(),
      email: "user@example.com",
      passwordHash: "hidden",
      name: "User",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const response = toUserResponse(user);

    expect(response).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  });

  test("maps todos with fallback URL", () => {
    const todo: TodoRow = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      title: "Ship Bun API",
      order: 1,
      completed: false,
      url: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const response = toTodoResponse(todo, "http://localhost:8082");

    expect(response.url).toBe(`http://localhost:8082/todos/${todo.id}`);
    expect(response.createdAt).toBe(todo.createdAt);
    expect(response.updatedAt).toBe(todo.updatedAt);
  });
});
