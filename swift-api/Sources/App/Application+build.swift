import Foundation
import Hummingbird
import HummingbirdAuth
import HummingbirdValkey
import Logging
import NIOCore
import PostgresNIO
import Valkey

func buildApplication(
    configuration: ApplicationConfiguration,
    logger: Logger
) async throws -> some ApplicationProtocol {
    let env = Environment()

    // Database configuration
    let dbHost = env.get("DB_HOST") ?? "localhost"
    let dbPort = Int(env.get("DB_PORT") ?? "5432") ?? 5432
    let dbUsername = env.get("DB_USERNAME") ?? "todos_user"
    let dbPassword = env.get("DB_PASSWORD") ?? "todos_password"
    let dbName = env.get("DB_NAME") ?? "todos_benchmark"

    // Valkey configuration
    let valkeyHost = env.get("CACHE_HOST") ?? "localhost"
    let valkeyPort = Int(env.get("CACHE_PORT") ?? "6379") ?? 6379

    // JWT configuration
    let jwtSecret = env.get("JWT_SECRET") ?? "your-super-secret-jwt-key-change-in-production"

    // Base URL for todo URLs
    let baseURL = env.get("BASE_URL") ?? "http://localhost:8080"

    // Initialize PostgreSQL client
    var postgresConfig = PostgresClient.Configuration(
        host: dbHost,
        port: dbPort,
        username: dbUsername,
        password: dbPassword,
        database: dbName,
        tls: .disable
    )
    postgresConfig.options.maximumConnections = 25
    let postgresClient = PostgresClient(configuration: postgresConfig)

    // Initialize Valkey client
    let valkeyClient = ValkeyClient(
        .hostname(valkeyHost, port: valkeyPort),
        logger: Logger(label: "Valkey")
    )
    let persist = ValkeyPersistDriver(client: valkeyClient)

    // Initialize services
    let jwtService = await JWTService(secret: jwtSecret)
    let userRepository = UserPostgresRepository(client: postgresClient)
    let todoRepository = TodoPostgresRepository(client: postgresClient)

    // Build router
    let router = Router(context: AppRequestContext.self)

    // Health check
    router.get("health") { _, _ in
        return "OK"
    }

    // Add controllers
    AuthController(
        userRepository: userRepository,
        jwtService: jwtService
    ).addRoutes(to: router.group("auth"))

    // Todo routes with JWT authentication
    let todoGroup = router.group("todos")
        .add(middleware: JWTAuthenticator(jwtService: jwtService))
        .add(middleware: RequireAuthMiddleware())

    TodoController(
        repository: todoRepository,
        cache: persist,
        client: valkeyClient,
        baseURL: baseURL
    ).addRoutes(to: todoGroup)

    // Create application
    var app = Application(
        router: router,
        configuration: configuration,
        logger: logger
    )

    // Add services
    app.addServices(postgresClient, valkeyClient)

    return app
}
