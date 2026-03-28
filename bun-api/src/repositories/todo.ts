import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "../db/client";
import { type NewTodoRow, todos } from "../db/schema";

export interface UpdateTodoFields {
  title?: string;
  order?: number | null;
  completed?: boolean;
}

export async function createTodo(todo: NewTodoRow) {
  const [created] = await db.insert(todos).values(todo).returning();
  return created ?? null;
}

export async function findTodosByUserId(userId: string) {
  return db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(asc(todos.order), desc(todos.createdAt));
}

export async function findTodoById(id: string, userId: string) {
  const [todo] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .limit(1);

  return todo ?? null;
}

export async function updateTodoById(id: string, userId: string, input: UpdateTodoFields) {
  const patch: Partial<typeof todos.$inferInsert> = {
    updatedAt: new Date()
  };

  if ("title" in input && input.title !== undefined) {
    patch.title = input.title;
  }

  if ("order" in input) {
    patch.order = input.order ?? null;
  }

  if ("completed" in input && input.completed !== undefined) {
    patch.completed = input.completed;
  }

  const [updated] = await db
    .update(todos)
    .set(patch)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteTodoById(id: string, userId: string) {
  const [deleted] = await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning({ id: todos.id });

  return deleted ?? null;
}

export async function deleteAllTodosByUserId(userId: string) {
  const deleted = await db.delete(todos).where(eq(todos.userId, userId)).returning({ id: todos.id });
  return deleted.length;
}
