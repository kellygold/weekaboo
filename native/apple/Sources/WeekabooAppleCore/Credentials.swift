import Foundation
import Security

/// Secrets stay in the OS Keychain, never in documents, preferences or exports.
public final class CredentialVault {
    private let service: String
    public init(service: String = "app.weekaboo.calendar.credentials") { self.service = service }
    private func query(_ reference: String) throws -> [String: Any] {
        guard reference.range(of: "^[A-Za-z0-9._:-]{1,200}$", options: .regularExpression) != nil else { throw NativeFailure.validation }
        return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: reference, kSecAttrSynchronizable as String: false]
    }
    public func get(_ reference: String) throws -> String? {
        var request = try query(reference)
        request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else { throw NativeFailure.storage }
        return value
    }
    public func put(_ reference: String, value: String) throws {
        guard value.utf8.count <= 65536 else { throw NativeFailure.validation }
        var request = try query(reference)
        let attributes: [String: Any] = [kSecValueData as String: Data(value.utf8), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let result = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if result == errSecItemNotFound {
            request.merge(attributes) { _, value in value }
            guard SecItemAdd(request as CFDictionary, nil) == errSecSuccess else { throw NativeFailure.storage }
        } else if result != errSecSuccess { throw NativeFailure.storage }
    }
    public func remove(_ reference: String) throws {
        let status = SecItemDelete(try query(reference) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeFailure.storage }
    }
}
