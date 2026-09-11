import XCTest

// Run only on a disposable Weekaboo validation simulator. No provider account
// is connected and no calendar mutation is performed by this suite.
final class WeekabooUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "app.weekaboo.calendar")
        app.launch()
    }
    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    func testTaskSurvivesRestartAndCanBeCompletedAndDeleted() throws {
        let field = app.textFields.matching(NSPredicate(format: "placeholderValue == %@", "Something to get done…")).firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 30), app.debugDescription)
        let title = "Weekaboo iOS proof \(UUID().uuidString.prefix(8))"
        field.tap(); field.typeText(title + "\n")
        XCTAssertTrue(app.buttons["Edit " + title].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        attach("task-created")
        app.terminate(); app.launch()
        XCTAssertTrue(app.buttons["Edit " + title].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        attach("task-persisted-after-restart")
        app.buttons["Complete " + title].firstMatch.tap()
        let done = app.switches["Done"].firstMatch
        XCTAssertTrue(done.waitForExistence(timeout: 10)); done.tap()
        let edit = app.buttons["Edit " + title].firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 10), app.debugDescription)
        edit.tap()
        app.buttons["Delete task"].firstMatch.tap()
        app.buttons["Delete permanently"].firstMatch.tap()
        XCTAssertFalse(edit.waitForExistence(timeout: 2))
        attach("task-cleaned-up")
    }
    func testRotationAndCalendarViews() throws {
        defer { XCUIDevice.shared.orientation = .portrait }
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            let settings = app.buttons["Settings"].firstMatch
            XCTAssertTrue(settings.waitForExistence(timeout: 20))
            XCTAssertTrue(settings.isHittable)
            XCTAssertGreaterThanOrEqual(settings.frame.minX, 0)
            XCTAssertLessThanOrEqual(settings.frame.maxX, app.frame.width)
            for label in ["Day", "4 days", "Week", "Month"] {
                let control = app.switches[label].firstMatch
                XCTAssertTrue(control.waitForExistence(timeout: 10)); control.tap()
                XCTAssertEqual(control.value as? String, "1")
            }
            settings.tap()
            XCTAssertTrue(app.staticTexts["Comfort & readability"].firstMatch.waitForExistence(timeout: 10))
            attach(orientation == .portrait ? "settings-portrait" : "settings-landscape")
            app.buttons["Close settings"].firstMatch.tap()
        }
    }
    func testCalendarSetupAndSettingsOpen() throws {
        let calendars = app.buttons["Connected calendars"].firstMatch
        XCTAssertTrue(calendars.waitForExistence(timeout: 30), app.debugDescription)
        calendars.tap()
        let manage = app.buttons["Manage accounts"].firstMatch
        XCTAssertTrue(manage.waitForExistence(timeout: 10), app.debugDescription)
        manage.tap()
        XCTAssertTrue(app.staticTexts["Your first connected account will appear here."].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        attach("account-setup")
    }
}

#if !targetEnvironment(simulator)
// Explicit physical-device checks. Never reset the app or disconnect user accounts.
// Run a named test only; do not run the simulator suite against a personal device.
final class WeekabooPhysicalTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "app.weekaboo.calendar")
        app.launch()
    }
    private func capture(_ name: String) {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = name; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name + "-accessibility"; tree.lifetime = .keepAlways; add(tree)
    }
    func testPhysicalTaskLifecycle() throws {
        let field = app.textFields.matching(NSPredicate(format: "placeholderValue == %@", "Something to get done…")).firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 30))
        let title = "Weekaboo physical task proof \(UUID().uuidString.prefix(8))"
        app.switches["Backlog"].firstMatch.tap()
        field.tap(); field.typeText(title + "\n")
        let edit = app.buttons["Edit " + title].firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 15))
        capture("physical-task-created")
        app.terminate(); app.launch()
        XCTAssertTrue(edit.waitForExistence(timeout: 30))
        capture("physical-task-restarted")
        app.buttons["Complete " + title].firstMatch.tap()
        app.switches["Done"].firstMatch.tap()
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        app.buttons["Delete task"].firstMatch.tap()
        app.buttons["Delete permanently"].firstMatch.tap()
        XCTAssertFalse(edit.waitForExistence(timeout: 2))
        app.switches["Backlog"].firstMatch.tap()
        capture("physical-task-cleaned")
    }
    func testPhysicalFileRoundTrip() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let suffix = String(UUID().uuidString.prefix(8))
        let title = "Weekaboo file proof " + suffix
        let filename = "Weekaboo-proof-" + suffix
        app.switches["Backlog"].firstMatch.tap()
        let field = app.textFields.matching(NSPredicate(format: "placeholderValue == %@", "Something to get done…")).firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 20)); field.tap(); field.typeText(title + "\n")
        let edit = app.buttons["Edit " + title].firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        app.buttons["Settings"].firstMatch.tap(); app.buttons["Export tasks"].firstMatch.tap()
        let local = app.cells["DOC.sidebar.item.On My iPad"].firstMatch
        XCTAssertTrue(local.waitForExistence(timeout: 15)); local.tap()
        let name = app.textFields["DOCPicker.filenameTextField"].firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 10)); name.tap()
        let previous = name.value as? String ?? ""
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count) + filename)
        app.buttons["Save"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Backup sent to your file destination."].firstMatch.waitForExistence(timeout: 15))
        capture("physical-file-saved")
        app.buttons["Close settings"].firstMatch.tap()
        edit.tap(); app.buttons["Delete task"].firstMatch.tap(); app.buttons["Delete permanently"].firstMatch.tap()
        XCTAssertFalse(edit.waitForExistence(timeout: 2))
        app.buttons["Settings"].firstMatch.tap(); app.buttons["Import tasks"].firstMatch.tap()
        XCTAssertTrue(local.waitForExistence(timeout: 15)); local.tap()
        let file = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", filename)).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 15), app.debugDescription); file.tap()
        XCTAssertTrue(app.staticTexts["tasks to add"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Add tasks"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Added 1 tasks. Kept 0 different existing versions."].firstMatch.waitForExistence(timeout: 15))
        app.buttons["Close settings"].firstMatch.tap()
        XCTAssertTrue(edit.waitForExistence(timeout: 10)); capture("physical-file-imported")
        edit.tap(); app.buttons["Delete task"].firstMatch.tap(); app.buttons["Delete permanently"].firstMatch.tap()
        XCTAssertFalse(edit.waitForExistence(timeout: 2))
        removeProofBackup(filename)
        capture("physical-file-roundtrip-cleaned")
    }
    private func removeProofBackup(_ filename: String) {
        XCTAssertNotNil(filename.range(of: "^Weekaboo-proof-[A-F0-9]{8}$", options: .regularExpression))
        let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
        files.launch()
        if files.buttons["close"].firstMatch.waitForExistence(timeout: 2) { files.buttons["close"].firstMatch.tap() }
        let local = files.cells["DOC.sidebar.item.On My iPad"].firstMatch
        XCTAssertTrue(local.waitForExistence(timeout: 15), files.debugDescription)
        let tree = XCTAttachment(string: files.debugDescription); tree.name = "physical-files-system-tree"; tree.lifetime = .keepAlways; add(tree)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); shot.name = "physical-files-system"; shot.lifetime = .keepAlways; add(shot)
        XCTAssertTrue(local.isHittable, files.debugDescription); local.tap()
        let file = files.cells.matching(NSPredicate(format: "label BEGINSWITH %@", filename)).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 10), files.debugDescription); file.press(forDuration: 1)
        let delete = files.buttons["Delete"].firstMatch
        XCTAssertTrue(delete.waitForExistence(timeout: 10), files.debugDescription); delete.tap()
        if files.alerts.buttons["Delete"].firstMatch.waitForExistence(timeout: 2) { files.alerts.buttons["Delete"].firstMatch.tap() }
        XCTAssertFalse(file.waitForExistence(timeout: 2))
        app.activate()
    }
    func testPhysicalWifiLossAndRecovery() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " – ")).firstMatch.waitForExistence(timeout: 30))
        let before = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " – ")).allElementsBoundByIndex.map { $0.label }.sorted()
        XCTAssertFalse(before.isEmpty, "Expected connected calendar events before offline test")
        let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        settings.launch()
        let wifiCell = settings.buttons["com.apple.settings.wifi"].firstMatch
        XCTAssertTrue(wifiCell.waitForExistence(timeout: 15), settings.debugDescription); wifiCell.tap()
        let wifi = settings.switches.matching(NSPredicate(format: "label MATCHES %@", "Wi.Fi")).firstMatch
        XCTAssertTrue(wifi.waitForExistence(timeout: 10), settings.debugDescription); XCTAssertEqual(wifi.value as? String, "1")
        defer { settings.activate(); if wifi.exists && wifi.value as? String == "0" { wifi.tap() }; app.activate() }
        wifi.tap(); XCTAssertEqual(wifi.value as? String, "0")
        app.terminate(); app.launch()
        XCTAssertTrue(app.buttons["Settings"].firstMatch.waitForExistence(timeout: 30))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " – ")).firstMatch.waitForExistence(timeout: 30))
        let after = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " – ")).allElementsBoundByIndex.map { $0.label }.sorted()
        XCTAssertEqual(after, before, "Cached calendar events must survive actual Wi-Fi loss and cold launch")
        capture("physical-wifi-off-cached-calendar")
        settings.activate(); XCTAssertEqual(wifi.value as? String, "0"); wifi.tap(); XCTAssertEqual(wifi.value as? String, "1")
        app.activate()
        let refresh = app.buttons["Refresh calendars"].firstMatch
        XCTAssertTrue(refresh.waitForExistence(timeout: 30))
        let enabled = NSPredicate(format: "enabled == true")
        expectation(for: enabled, evaluatedWith: refresh); waitForExpectations(timeout: 90)
        refresh.tap()
        expectation(for: enabled, evaluatedWith: refresh); waitForExpectations(timeout: 90)
        capture("physical-wifi-restored")
    }
    func testPhysicalFilePickerCancellation() throws {
        let settings = app.buttons["Settings"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 30)); settings.tap()
        for action in ["Import tasks", "Export tasks"] {
            let button = app.buttons[action].firstMatch
            XCTAssertTrue(button.waitForExistence(timeout: 10)); button.tap()
            let cancel = app.buttons["Cancel"].firstMatch
            XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
            capture(action == "Import tasks" ? "physical-import-picker" : "physical-export-picker")
            cancel.tap()
            XCTAssertTrue(app.buttons["Close settings"].firstMatch.waitForExistence(timeout: 10))
        }
        app.buttons["Close settings"].firstMatch.tap()
        capture("physical-file-pickers-cancelled")
    }
    func testPhysicalRotationAndSettings() throws {
        let original = XCUIDevice.shared.orientation
        let originalView = ["Day", "4 days", "Week", "Month"].first { app.switches[$0].firstMatch.value as? String == "1" }
        defer {
            if let view = originalView { app.switches[view].firstMatch.tap() }
            XCUIDevice.shared.orientation = original
        }
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            let settings = app.buttons["Settings"].firstMatch
            XCTAssertTrue(settings.waitForExistence(timeout: 20)); XCTAssertTrue(settings.isHittable)
            XCTAssertGreaterThanOrEqual(settings.frame.minX, 0)
            XCTAssertLessThanOrEqual(settings.frame.maxX, app.frame.width)
            for label in ["Day", "4 days", "Week", "Month"] {
                let control = app.switches[label].firstMatch
                XCTAssertTrue(control.waitForExistence(timeout: 10)); control.tap()
                XCTAssertEqual(control.value as? String, "1")
            }
            settings.tap()
            XCTAssertTrue(app.staticTexts["Comfort & readability"].firstMatch.waitForExistence(timeout: 10))
            capture(orientation == .portrait ? "physical-settings-portrait" : "physical-settings-landscape")
            app.buttons["Close settings"].firstMatch.tap()
        }
    }
    func testInspectConnectedAccounts() throws {
        let calendars = app.buttons["Connected calendars"].firstMatch
        XCTAssertTrue(calendars.waitForExistence(timeout: 30))
        capture("physical-calendar")
        calendars.tap()
        let manage = app.buttons["Manage accounts"].firstMatch
        XCTAssertTrue(manage.waitForExistence(timeout: 15))
        capture("physical-connected-calendars")
        manage.tap()
        XCTAssertTrue(app.buttons["Connect Google"].firstMatch.waitForExistence(timeout: 15))
        XCTAssertEqual(app.staticTexts.matching(identifier: "Connected").count, 3)
        capture("physical-accounts")
    }
}
#endif
