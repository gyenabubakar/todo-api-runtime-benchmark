import Foundation
import Hummingbird
import HummingbirdAuth
import HummingbirdValkey
import Valkey

struct TodoController<Client: ValkeyClientProtocol & Sendable>: Sendable {
    let repository: TodoRepository
    let cache: ValkeyPersistDriver<Client>
    let baseURL: String
    let cacheTTL: Duration = .seconds(300)

    func addRoutes(to group: RouterGroup<AppRequestContext>) {
        group.get(use: listTodos)
        group.post(use: createTodo)
        group.get(":id", use: getTodo)
        group.patch(":id", use: updateTodo)
        group.delete(":id", use: deleteTodo)
        group.delete(use: deleteAllTodos)
    }

    private func getAuthenticatedUser(context: AppRequestContext) throws -> AuthenticatedUser {
        guard let user = context.identity else {
            throw HTTPError(.unauthorized, message: "Authentication required")
        }
        return user
    }

    @Sendable
    func listTodos(request: Request, context: AppRequestContext) async throws -> [TodoResponse] {
        let user = try getAuthenticatedUser(context: context)
        let cacheKey = CacheKeys.todosKey(userId: user.id)

        // Try cache first
        if let cached: [TodoResponse] = try? await cache.get(key: cacheKey, as: [TodoResponse].self)
        {
            return cached
        }

        // Fetch from database
        let todos = try await repository.findAll(userId: user.id)
        let response = todos.map { TodoResponse(from: $0, baseURL: baseURL) }

        // Cache the result
        try? await cache.set(key: cacheKey, value: response, expires: cacheTTL)

        return response
    }

    @Sendable
    func createTodo(request: Request, context: AppRequestContext) async throws -> EditedResponse<
        TodoResponse
    > {
        let user = try getAuthenticatedUser(context: context)
        let input = try await request.decode(as: CreateTodoRequest.self, context: context)

        let todo = Todo(
            userId: user.id,
            title: input.title,
            order: input.order,
            completed: false,
            url: nil
        )

        let createdTodo = try await repository.create(todo)

        // Invalidate cache
        try? await cache.remove(key: CacheKeys.todosKey(userId: user.id))

        let response = TodoResponse(from: createdTodo, baseURL: baseURL)
        return EditedResponse(status: .created, response: response)
    }

    @Sendable
    func getTodo(request: Request, context: AppRequestContext) async throws -> TodoResponse {
        let user = try getAuthenticatedUser(context: context)

        guard let idString = context.parameters.get("id"),
            let id = UUID(uuidString: idString)
        else {
            throw HTTPError(.badRequest, message: "Invalid todo ID")
        }

        let cacheKey = CacheKeys.todoKey(id: id)

        // Try cache first
        if let cached: TodoResponse = try? await cache.get(key: cacheKey, as: TodoResponse.self) {
            return cached
        }

        guard let todo = try await repository.findById(id, userId: user.id) else {
            throw HTTPError(.notFound, message: "Todo not found")
        }

        let response = TodoResponse(from: todo, baseURL: baseURL)

        // Cache the result
        try? await cache.set(key: cacheKey, value: response, expires: cacheTTL)

        return response
    }

    @Sendable
    func updateTodo(request: Request, context: AppRequestContext) async throws -> TodoResponse {
        let user = try getAuthenticatedUser(context: context)

        guard let idString = context.parameters.get("id"),
            let id = UUID(uuidString: idString)
        else {
            throw HTTPError(.badRequest, message: "Invalid todo ID")
        }

        let input = try await request.decode(as: UpdateTodoRequest.self, context: context)

        guard var todo = try await repository.findById(id, userId: user.id) else {
            throw HTTPError(.notFound, message: "Todo not found")
        }

        if let title = input.title {
            todo.title = title
        }
        if let order = input.order {
            todo.order = order
        }
        if let completed = input.completed {
            todo.completed = completed
        }

        let updatedTodo = try await repository.update(todo)

        // Invalidate caches
        try? await cache.remove(key: CacheKeys.todosKey(userId: user.id))
        try? await cache.remove(key: CacheKeys.todoKey(id: id))

        return TodoResponse(from: updatedTodo, baseURL: baseURL)
    }

    @Sendable
    func deleteTodo(request: Request, context: AppRequestContext) async throws
        -> HTTPResponse.Status
    {
        let user = try getAuthenticatedUser(context: context)

        guard let idString = context.parameters.get("id"),
            let id = UUID(uuidString: idString)
        else {
            throw HTTPError(.badRequest, message: "Invalid todo ID")
        }

        guard try await repository.findById(id, userId: user.id) != nil else {
            throw HTTPError(.notFound, message: "Todo not found")
        }

        _ = try await repository.delete(id, userId: user.id)

        // Invalidate caches
        try? await cache.remove(key: CacheKeys.todosKey(userId: user.id))
        try? await cache.remove(key: CacheKeys.todoKey(id: id))

        return .noContent
    }

    @Sendable
    func deleteAllTodos(request: Request, context: AppRequestContext) async throws
        -> HTTPResponse.Status
    {
        let user = try getAuthenticatedUser(context: context)

        _ = try await repository.deleteAll(userId: user.id)

        // Invalidate cache
        try? await cache.remove(key: CacheKeys.todosKey(userId: user.id))

        return .noContent
    }
}
