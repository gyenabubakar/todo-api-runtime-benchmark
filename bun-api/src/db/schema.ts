import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const todos = pgTable("todos", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  order: integer("order"),
  completed: boolean("completed").notNull(),
  url: varchar("url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;
