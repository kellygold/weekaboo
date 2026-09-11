import UIKit
import UniformTypeIdentifiers
import Capacitor
import WeekabooAppleCore

@objc(WeekabooViewController)
final class WeekabooViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WeekabooStorage())
        bridge?.registerPluginInstance(WeekabooHttp())
        bridge?.registerPluginInstance(WeekabooFiles())
        bridge?.registerPluginInstance(WeekabooLifecycle())
        bridge?.registerPluginInstance(WeekabooAuthorization())
    }
}
@objc(WeekabooStorage)
final class WeekabooStorage: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WeekabooStorage"
    let jsName = "WeekabooStorage"
    let pluginMethods: [CAPPluginMethod] = ["readTasks", "writeTasks", "readDocument", "writeDocument", "vaultGet", "vaultPut", "vaultRemove"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let queue = DispatchQueue(label: "app.weekaboo.storage")
    private var database: DocumentDatabase?
    private let vault = CredentialVault()
    private func storage() throws -> DocumentDatabase {
        if let database = database { return database }
        let parent = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Weekaboo", isDirectory: true)
        let value = try DocumentDatabase(url: parent.appendingPathComponent("local.db"))
        database = value; return value
    }
    private func execute(_ call: CAPPluginCall, _ work: @escaping () throws -> [String: Any]) {
        queue.async {
            do { let value = try work(); DispatchQueue.main.async { call.resolve(value) } }
            catch { DispatchQueue.main.async { call.reject("Local storage could not complete this operation. Your existing data has been retained.", error is NativeFailure && String(describing: error) == "validation" ? "validation" : "unavailable") } }
        }
    }
    private func revision(_ call: CAPPluginCall) throws -> Int64 {
        guard let number = call.getDouble("revision"), number.isFinite, number >= 0, number < 9007199254740991, number.rounded(.towardZero) == number else { throw NativeFailure.validation }
        return Int64(number)
    }
    @objc func readTasks(_ call: CAPPluginCall) { execute(call) {
        let snapshot = try self.storage().read("task-snapshot")
        let value = try snapshot.value.map { try JSONSerialization.jsonObject(with: Data($0.utf8)) } ?? []
        guard let tasks = value as? [[String: Any]] else { throw NativeFailure.storage }
        return ["revision": snapshot.revision, "tasks": tasks]
    } }
    @objc func writeTasks(_ call: CAPPluginCall) { execute(call) {
        guard let tasks = call.getArray("tasks", [String: Any].self) else { throw NativeFailure.validation }
        let data = try JSONSerialization.data(withJSONObject: tasks)
        guard let value = String(data: data, encoding: .utf8) else { throw NativeFailure.validation }
        return ["committed": try self.storage().compareAndSet("task-snapshot", revision: self.revision(call), value: value)]
    } }
    @objc func readDocument(_ call: CAPPluginCall) { execute(call) {
        guard let key = call.getString("key") else { throw NativeFailure.validation }
        let snapshot = try self.storage().read(key)
        return ["revision": snapshot.revision, "value": snapshot.value as Any? ?? NSNull()]
    } }
    @objc func writeDocument(_ call: CAPPluginCall) { execute(call) {
        guard let key = call.getString("key"), let value = call.getString("value") else { throw NativeFailure.validation }
        return ["committed": try self.storage().compareAndSet(key, revision: self.revision(call), value: value)]
    } }
    @objc func vaultGet(_ call: CAPPluginCall) { execute(call) {
        guard let reference = call.getString("reference") else { throw NativeFailure.validation }
        return ["value": try self.vault.get(reference) as Any? ?? NSNull()]
    } }
    @objc func vaultPut(_ call: CAPPluginCall) { execute(call) {
        guard let reference = call.getString("reference"), let value = call.getString("value") else { throw NativeFailure.validation }
        try self.vault.put(reference, value: value); return [:]
    } }
    @objc func vaultRemove(_ call: CAPPluginCall) { execute(call) {
        guard let reference = call.getString("reference") else { throw NativeFailure.validation }
        try self.vault.remove(reference); return [:]
    } }
}
@objc(WeekabooHttp)
final class WeekabooHttp: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WeekabooHttp"
    let jsName = "WeekabooHttp"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)]
    @objc func request(_ call: CAPPluginCall) {
        guard let url = call.getString("url"), let method = call.getString("method") else { call.reject("Invalid provider request.", "validation"); return }
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        NativeHTTP.request(url: url, method: method, headers: headers, body: call.getString("body"), timeout: (call.getDouble("timeoutMs") ?? 30000) / 1000) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response): call.resolve(["status": response.status, "headers": response.headers, "body": response.body])
                case .failure: call.reject("Provider request could not be confirmed.", "unavailable")
                }
            }
        }
    }
}

/** User-selected JSON only. Native paths and account stores never cross this port. */
@objc(WeekabooFiles)
final class WeekabooFiles: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "WeekabooFiles"
    let jsName = "WeekabooFiles"
    let pluginMethods: [CAPPluginMethod] = ["pick", "save"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var pending: CAPPluginCall?
    private var exportDirectory: URL?
    private var exporting = false
    private let worker = DispatchQueue(label: "app.weekaboo.files")
    @objc func pick(_ call: CAPPluginCall) { DispatchQueue.main.async { self.begin(call, text: nil) } }
    @objc func save(_ call: CAPPluginCall) { DispatchQueue.main.async {
        guard let text = call.getString("contents"), text.utf8.count <= 4_000_000,
              let name = call.getString("name"), name.range(of: "^weekaboo-tasks-[0-9-]+\\.json$", options: .regularExpression) != nil else {
            call.reject("Invalid task backup.", "validation"); return
        }
        self.begin(call, text: text)
    } }
    private func begin(_ call: CAPPluginCall, text: String?) {
        guard pending == nil else { call.reject("A file picker is already open.", "busy"); return }
        guard let controller = bridge?.viewController, controller.presentedViewController == nil else { call.reject("Close the other system window before choosing a file.", "busy"); return }
        pending = call; exporting = text != nil
        do {
            let picker: UIDocumentPickerViewController
            if let text = text {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent("weekaboo-export-" + UUID().uuidString, isDirectory: true)
                exportDirectory = directory
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent(call.getString("name")!)
                try Data(text.utf8).write(to: file, options: [.atomic, .completeFileProtection])
                picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            } else { picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: false) }
            picker.allowsMultipleSelection = false; picker.delegate = self
            controller.present(picker, animated: true)
        } catch { finish(error: "The task backup could not be prepared.") }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(cancelled: true) }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if exporting { finish(); return }
        guard let url = urls.first else { finish(cancelled: true); return }
        worker.async {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            var text: String?
            var readFailed = false
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { readable in
                do {
                    let handle = try FileHandle(forReadingFrom: readable)
                    defer { try? handle.close() }
                    // Bounded read even when a provider reports an incorrect file size.
                    var data = Data()
                    while let chunk = try handle.read(upToCount: 8192), !chunk.isEmpty {
                        data.append(chunk); if data.count > 4_000_000 { throw NativeFailure.validation }
                    }
                    guard let decoded = String(data: data, encoding: .utf8) else { throw NativeFailure.validation }
                    text = decoded
                } catch { readFailed = true }
            }
            DispatchQueue.main.async {
                if readFailed || coordinationError != nil || text == nil { self.finish(error: "Choose a readable JSON task backup smaller than 4 MB.") }
                else { self.finish(text: text) }
            }
        }
    }
    private func finish(text: String? = nil, cancelled: Bool = false, error: String? = nil) {
        guard let call = pending else { return }
        pending = nil
        if let directory = exportDirectory { try? FileManager.default.removeItem(at: directory) }
        exportDirectory = nil
        if let error = error { call.reject(error, "unavailable") }
        else if exporting { call.resolve(["saved": !cancelled]) }
        else { call.resolve(["contents": text as Any? ?? NSNull()]) }
    }
}

@objc(WeekabooLifecycle)
final class WeekabooLifecycle: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WeekabooLifecycle"
    let jsName = "WeekabooLifecycle"
    let pluginMethods: [CAPPluginMethod] = []
    private var observers: [NSObjectProtocol] = []
    override func load() {
        for (name, active) in [(UIApplication.didBecomeActiveNotification, true), (UIApplication.willResignActiveNotification, false)] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.notifyListeners("activity", data: ["active": active])
            })
        }
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
