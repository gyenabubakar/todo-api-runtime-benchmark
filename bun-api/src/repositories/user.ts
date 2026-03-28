import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { type NewUserRow, users } from "../db/schema";

export async function createUser(user: NewUserRow) {
  const [created] = await db.insert(users).values(user).returning();
  return created ?? null;
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
