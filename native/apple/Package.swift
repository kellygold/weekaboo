// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "WeekabooAppleCore",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "WeekabooAppleCore", targets: ["WeekabooAppleCore"])],
    targets: [
        .target(name: "WeekabooAppleCore", linkerSettings: [.linkedLibrary("sqlite3")]),
        .testTarget(name: "WeekabooAppleCoreTests", dependencies: ["WeekabooAppleCore"])
    ]
)
