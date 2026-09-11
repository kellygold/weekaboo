import XCTest
@testable import WeekabooAppleCore
final class DocumentsTests: XCTestCase {
    func testDurabilityAndCompareAndSet() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("local.db")
        var database: DocumentDatabase? = try DocumentDatabase(url: url)
        XCTAssertEqual(try database!.read("tasks").revision, 0)
        XCTAssertTrue(try database!.compareAndSet("tasks", revision: 0, value: "[\"original\"]"))
        XCTAssertFalse(try database!.compareAndSet("tasks", revision: 0, value: "[\"lost update\"]"))
        database = nil
        let reopened = try DocumentDatabase(url: url)
        XCTAssertEqual(try reopened.read("tasks").value, "[\"original\"]")
        XCTAssertEqual(try reopened.read("tasks").revision, 1)
        XCTAssertTrue(try reopened.compareAndSet("tasks", revision: 1, value: "[\"saved\"]"))
    }
    func testIndependentConnectionsCannotOverwriteEachOther() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("local.db")
        let a = try DocumentDatabase(url: url), b = try DocumentDatabase(url: url)
        let snapshot = try b.read("event-operations")
        XCTAssertTrue(try a.compareAndSet("event-operations", revision: 0, value: "durable intent"))
        XCTAssertFalse(try b.compareAndSet("event-operations", revision: snapshot.revision, value: "stale intent"))
        XCTAssertEqual(try b.read("event-operations").value, "durable intent")
        XCTAssertThrowsError(try b.compareAndSet("../outside", revision: 0, value: "bad"))
        XCTAssertThrowsError(try b.compareAndSet("event-operations", revision: -1, value: "bad"))
        XCTAssertThrowsError(try b.compareAndSet("event-operations", revision: 9007199254740991, value: "bad"))
    }
}
