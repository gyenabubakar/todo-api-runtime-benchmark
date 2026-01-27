import Foundation
import Hummingbird
import HummingbirdBcrypt

struct AuthController: Sendable {
    let userRepository: UserRepository
    let jwtService: JWTService

    func addRoutes(to group: RouterGroup<AppRequestContext>) {
        group.post("register", use: register)
        group.post("login", use: login)
    }

    @Sendable
    func register(request: Request, context: AppRequestContext) async throws -> Response {
        let input = try await request.decode(as: RegisterRequest.self, context: context)

        // Check if user already exists
        if (try await userRepository.findByEmail(input.email)) != nil {
            throw HTTPError(.conflict, message: "Email already registered")
        }

        // Hash password
        let passwordHash = Bcrypt.hash(input.password)

        // Create user
        let user = User(
            email: input.email,
            passwordHash: passwordHash,
            name: input.name
        )

        let createdUser = try await userRepository.create(user)

        // Generate token
        let token = try await jwtService.generateToken(for: createdUser)

        let response = AuthResponse(
            token: token,
            user: UserResponse(from: createdUser)
        )

        return try Response(
            status: .created,
            headers: [.contentType: "application/json"],
            body: .init(data: JSONEncoder().encode(response))
        )
    }

    @Sendable
    func login(request: Request, context: AppRequestContext) async throws -> Response {
        let input = try await request.decode(as: LoginRequest.self, context: context)

        // Find user
        guard let user = try await userRepository.findByEmail(input.email) else {
            throw HTTPError(.unauthorized, message: "Invalid credentials")
        }

        // Verify password
        guard try await Bcrypt.verify(input.password, hash: user.passwordHash) else {
            throw HTTPError(.unauthorized, message: "Invalid credentials")
        }

        // Generate token
        let token = try await jwtService.generateToken(for: user)

        let response = AuthResponse(
            token: token,
            user: UserResponse(from: user)
        )

        return try Response(
            status: .ok,
            headers: [.contentType: "application/json"],
            body: .init(data: JSONEncoder().encode(response))
        )
    }
}
