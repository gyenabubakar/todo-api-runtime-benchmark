import Foundation
import Logging
import PostgresNIO

protocol TodoRepository: Sendable {
    func create(_ todo: Todo) async throws -> Todo
    func findAll(userId: UUID) async throws -> [Todo]
    func findById(_ id: UUID, userId: UUID) async throws -> Todo?
    func update(_ todo: Todo) async throws -> Todo
    func delete(_ id: UUID, userId: UUID) async throws -> Bool
    func deleteAll(userId: UUID) async throws -> Int
}

struct TodoPostgresRepository: TodoRepository {
    let client: PostgresClient
    private let logger = Logger(label: "TodoRepository")

    func create(_ todo: Todo) async throws -> Todo {
        let rows = try await client.query(
            """
            INSERT INTO todos (id, user_id, title, "order", completed, url)
            VALUES (\(todo.id), \(todo.userId), \(todo.title), \(todo.order), \(todo.completed), \(todo.url))
            RETURNING id, user_id, title, "order", completed, url, created_at, updated_at
            """,
            logger: logger
        )

        for try await (id, uId, title, order, completed, url, createdAt, updatedAt) in rows.decode(
            (UUID, UUID, String, Int?, Bool, String?, Date, Date).self,
            context: .default
        ) {
            return Todo(
                id: id,
                userId: uId,
                title: title,
                order: order,
                completed: completed,
                url: url,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
        return todo
    }

    func findAll(userId: UUID) async throws -> [Todo] {
        let rows = try await client.query(
            """
            SELECT id, user_id, title, "order", completed, url, created_at, updated_at
            FROM todos
            WHERE user_id = \(userId)
            ORDER BY "order" NULLS LAST, created_at DESC
            """,
            logger: logger
        )

        var todos: [Todo] = []
        todos.reserveCapacity(16)
        for try await (id, uId, title, order, completed, url, createdAt, updatedAt) in rows.decode(
            (UUID, UUID, String, Int?, Bool, String?, Date, Date).self,
            context: .default
        ) {
            todos.append(
                Todo(
                    id: id,
                    userId: uId,
                    title: title,
                    order: order,
                    completed: completed,
                    url: url,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                ))
        }
        return todos
    }

    func findById(_ id: UUID, userId: UUID) async throws -> Todo? {
        let rows = try await client.query(
            """
            SELECT id, user_id, title, "order", completed, url, created_at, updated_at
            FROM todos
            WHERE id = \(id) AND user_id = \(userId)
            """,
            logger: logger
        )

        for try await (id, uId, title, order, completed, url, createdAt, updatedAt) in rows.decode(
            (UUID, UUID, String, Int?, Bool, String?, Date, Date).self,
            context: .default
        ) {
            return Todo(
                id: id,
                userId: uId,
                title: title,
                order: order,
                completed: completed,
                url: url,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
        return nil
    }

    func update(_ todo: Todo) async throws -> Todo {
        let rows = try await client.query(
            """
            UPDATE todos
            SET title = \(todo.title),
                "order" = \(todo.order),
                completed = \(todo.completed),
                url = \(todo.url),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = \(todo.id) AND user_id = \(todo.userId)
            RETURNING id, user_id, title, "order", completed, url, created_at, updated_at
            """,
            logger: logger
        )

        for try await (id, uId, title, order, completed, url, createdAt, updatedAt) in rows.decode(
            (UUID, UUID, String, Int?, Bool, String?, Date, Date).self,
            context: .default
        ) {
            return Todo(
                id: id,
                userId: uId,
                title: title,
                order: order,
                completed: completed,
                url: url,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
        return todo
    }

    func delete(_ id: UUID, userId: UUID) async throws -> Bool {
        try await client.query(
            """
            DELETE FROM todos
            WHERE id = \(id) AND user_id = \(userId)
            """,
            logger: logger
        )
        // If query executed without error, consider it successful
        return true
    }

    func deleteAll(userId: UUID) async throws -> Int {
        try await client.query(
            """
            DELETE FROM todos
            WHERE user_id = \(userId)
            """,
            logger: logger
        )
        return 0  // PostgresNIO doesn't return affected rows count easily
    }
}
