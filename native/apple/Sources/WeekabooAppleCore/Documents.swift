import Foundation
import SQLite3

public enum NativeFailure: Error { case validation, storage, incompatibleSchema, unavailable, oversized }
public struct DocumentSnapshot { public let revision: Int64; public let value: String? }

/// Durable CAS documents. The TS service engine owns each document's data schema.
public final class DocumentDatabase {
    private var db: OpaquePointer?
    private let lock = NSLock()
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    public init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { throw NativeFailure.storage }
        do {
            sqlite3_busy_timeout(db, 5000)
            try execute("PRAGMA journal_mode=WAL")
            try execute("PRAGMA synchronous=FULL")
            let version = try prepare("PRAGMA user_version")
            defer { sqlite3_finalize(version) }
            guard sqlite3_step(version) == SQLITE_ROW else { throw NativeFailure.storage }
            let number = sqlite3_column_int(version, 0)
            guard number <= 1 else { throw NativeFailure.incompatibleSchema }
            if number == 0 {
                try execute("BEGIN IMMEDIATE")
                do {
                    try execute("CREATE TABLE documents (key TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL)")
                    try execute("PRAGMA user_version=1")
                    try execute("COMMIT")
                } catch { try? execute("ROLLBACK"); throw error }
            }
            var directory = url.deletingLastPathComponent()
            var resource = URLResourceValues(); resource.isExcludedFromBackup = true
            try directory.setResourceValues(resource)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
            #endif
        } catch { sqlite3_close(db); db = nil; throw error }
    }
    deinit { sqlite3_close(db) }
    private func validate(_ key: String) throws {
        guard key.range(of: "^[a-z][a-z0-9-]{0,63}$", options: .regularExpression) != nil else { throw NativeFailure.validation }
    }
    private func prepare(_ sql: String) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let result = statement else { throw NativeFailure.storage }
        return result
    }
    private func execute(_ sql: String) throws { guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw NativeFailure.storage } }
    private func readUnlocked(_ key: String) throws -> DocumentSnapshot {
        let statement = try prepare("SELECT revision, body FROM documents WHERE key=?")
        defer { sqlite3_finalize(statement) }
        guard sqlite3_bind_text(statement, 1, key, -1, transient) == SQLITE_OK else { throw NativeFailure.storage }
        switch sqlite3_step(statement) {
        case SQLITE_DONE: return DocumentSnapshot(revision: 0, value: nil)
        case SQLITE_ROW:
            guard let body = sqlite3_column_text(statement, 1) else { throw NativeFailure.storage }
            return DocumentSnapshot(revision: sqlite3_column_int64(statement, 0), value: String(cString: body))
        default: throw NativeFailure.storage
        }
    }
    public func read(_ key: String) throws -> DocumentSnapshot {
        try validate(key); lock.lock(); defer { lock.unlock() }
        return try readUnlocked(key)
    }
    @discardableResult public func compareAndSet(_ key: String, revision: Int64, value: String) throws -> Bool {
        try validate(key)
        guard revision >= 0 && revision < 9007199254740991 && value.utf16.count <= 8_000_000 && !value.contains("\0") else { throw NativeFailure.validation }
        lock.lock(); defer { lock.unlock() }
        try execute("BEGIN IMMEDIATE")
        do {
            let current = try readUnlocked(key)
            guard current.revision == revision else { try execute("ROLLBACK"); return false }
            let statement = try prepare("INSERT INTO documents(key,revision,body) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,body=excluded.body")
            defer { sqlite3_finalize(statement) }
            guard sqlite3_bind_text(statement, 1, key, -1, transient) == SQLITE_OK,
                  sqlite3_bind_int64(statement, 2, revision + 1) == SQLITE_OK,
                  sqlite3_bind_text(statement, 3, value, -1, transient) == SQLITE_OK,
                  sqlite3_step(statement) == SQLITE_DONE else { throw NativeFailure.storage }
            try execute("COMMIT")
            return true
        } catch { try? execute("ROLLBACK"); throw error }
    }
}
