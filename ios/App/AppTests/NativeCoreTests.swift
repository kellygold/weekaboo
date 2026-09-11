import XCTest
import Security
import WeekabooAppleCore

// Direct native adapters in the simulator test process. Distinct temporary
// database and Keychain namespace: never reads or clears the app's account vault.
final class NativeCoreTests: XCTestCase {
    func testDatabasePersistsAndRejectsStaleWriter() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("proof.sqlite")
        var first: DocumentDatabase? = try DocumentDatabase(url: url)
        XCTAssertTrue(try first!.compareAndSet("tasks", revision: 0, value: "synthetic task"))
        first = nil
        let reopened = try DocumentDatabase(url: url), concurrent = try DocumentDatabase(url: url)
        XCTAssertEqual(try reopened.read("tasks").value, "synthetic task")
        XCTAssertTrue(try reopened.compareAndSet("tasks", revision: 1, value: "completed"))
        XCTAssertFalse(try concurrent.compareAndSet("tasks", revision: 1, value: "stale"))
        XCTAssertEqual(try concurrent.read("tasks").value, "completed")
        XCTAssertThrowsError(try reopened.read("../outside"))
    }
    func testKeychainIsolationAndRejectedUpdatePreservesValue() throws {
        let service = "app.weekaboo.validation.\(UUID().uuidString)"
        let vault = CredentialVault(service: service)
        defer { try? vault.remove("fixture") }
        var probe: CFTypeRef?
        let probeStatus = SecItemCopyMatching([kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:"fixture", kSecReturnData as String:true] as CFDictionary, &probe)
        XCTAssertEqual(probeStatus, errSecItemNotFound, "Isolated Keychain query failed with OSStatus \(probeStatus)")
        XCTAssertNil(try vault.get("fixture"))
        try vault.put("fixture", value: "synthetic-only")
        XCTAssertEqual(try CredentialVault(service: service).get("fixture"), "synthetic-only")
        XCTAssertNil(try CredentialVault(service: service + ".other").get("fixture"))
        XCTAssertThrowsError(try vault.put("fixture", value: String(repeating: "x", count: 65537)))
        XCTAssertEqual(try vault.get("fixture"), "synthetic-only")
        var attributes: CFTypeRef?
        let query: [String:Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:"fixture", kSecReturnAttributes as String:true]
        XCTAssertEqual(SecItemCopyMatching(query as CFDictionary, &attributes), errSecSuccess)
        let saved = try XCTUnwrap(attributes as? [String:Any])
        XCTAssertEqual(saved[kSecAttrAccessible as String] as? String, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
        XCTAssertNotEqual(saved[kSecAttrSynchronizable as String] as? Bool, true)
        try vault.remove("fixture"); try vault.remove("fixture")
        XCTAssertNil(try vault.get("fixture"))
    }
    func testInvalidTransportRequestsFailBeforeNetworking() {
        for (url, method, headers) in [
            ("http://example.test", "GET", [String:String]()),
            ("https://user:password@example.test", "GET", [:]),
            ("https://example.test", "TRACE", [:]),
            ("https://example.test", "GET", ["X-Test":"bad\r\nInjected: value"]),
            ("https://example.test", "GET", ["Bad\r\nName":"value"]),
            ("https://example.test", "GET", ["X-Test":"bad\nvalue"]),
            ("https://example.test", "GET", ["X-Test":"bad\rvalue"])
        ] {
            let done = expectation(description:"Rejected unsafe native request")
            NativeHTTP.request(url:url, method:method, headers:headers, body:nil, timeout:1) { result in
                switch result { case .failure(NativeFailure.validation): break; default: XCTFail("Unsafe request was not rejected as validation: \(url), \(method), \(result)") }
                done.fulfill()
            }
            wait(for:[done],timeout:2)
        }
    }
}
