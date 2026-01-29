import Foundation

enum CacheKeys {
    static func todosKey(userId: UUID) -> String {
        "todos:user:\(userId.uuidString)"
    }

    static func todoKey(id: UUID) -> String {
        "todo:\(id.uuidString)"
    }
}
