import type { TodoRow, UserRow } from "../db/schema";
import type { TodoResponse, UserResponse } from "./contracts";

export function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function toTodoResponse(todo: TodoRow, baseUrl: string): TodoResponse {
  return {
    id: todo.id,
    title: todo.title,
    order: todo.order ?? null,
    completed: todo.completed,
    url: todo.url ?? `${baseUrl}/todos/${todo.id}`,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt
  };
}
