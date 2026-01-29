// swift-tools-version:6.2.3
import PackageDescription

let package = Package(
    name: "TodosAPI",
    platforms: [
        .macOS(.v15)
    ],
    dependencies: [
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.5.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-auth.git", from: "2.1.0"),
        .package(
            url: "https://github.com/hummingbird-project/hummingbird-valkey.git", from: "0.2.0"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.5.0"),
        .package(url: "https://github.com/vapor/postgres-nio.git", from: "1.21.0"),
        .package(url: "https://github.com/vapor/jwt-kit.git", from: "5.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Hummingbird", package: "hummingbird"),
                .product(name: "HummingbirdAuth", package: "hummingbird-auth"),
                .product(name: "HummingbirdBcrypt", package: "hummingbird-auth"),
                .product(name: "HummingbirdValkey", package: "hummingbird-valkey"),
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
                .product(name: "PostgresNIO", package: "postgres-nio"),
                .product(name: "JWTKit", package: "jwt-kit"),
            ],
            path: "Sources/App"
        ),
        .testTarget(
            name: "AppTests",
            dependencies: [
                .target(name: "App"),
                .product(name: "HummingbirdTesting", package: "hummingbird"),
            ],
            path: "Tests/AppTests"
        ),
    ]
)
