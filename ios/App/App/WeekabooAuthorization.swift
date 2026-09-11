import UIKit
import Capacitor
import GoogleSignIn
import MSAL
import CryptoKit
import WeekabooAppleCore

/// SDKs own consent and refresh. Only short-lived grants cross the private bridge.
/// Source implementation pending full Xcode compilation and native consent proof.
@objc(WeekabooAuthorization)
final class WeekabooAuthorization: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WeekabooAuthorization"
    let jsName = "WeekabooAuthorization"
    let pluginMethods: [CAPPluginMethod] = ["setup", "acquire", "forget"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var active = false
    private var microsoft: MSALPublicClientApplication?
    private let vault = CredentialVault(service: "app.weekaboo.calendar.google-sessions")
    private let googleScopes = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/userinfo.email"]
    private var bundleId: String { Bundle.main.bundleIdentifier ?? "app.weekaboo.calendar" }
    private var redirect: String { "msauth.\(bundleId)://auth" }
    private func config(_ name: String) -> String { Bundle.main.object(forInfoDictionaryKey: name) as? String ?? "" }
    private var googleID: String { config("WeekabooGoogleClientID") }
    private var microsoftID: String { config("WeekabooMicrosoftClientID") }
    private var googleScheme: String { googleID.split(separator: ".").reversed().joined(separator: ".") }
    private func hasScheme(_ scheme: String) -> Bool {
        let groups = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        return groups.contains { ($0["CFBundleURLSchemes"] as? [String] ?? []).contains(scheme) }
    }
    private var googleConfigured: Bool { googleID.range(of: "^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$", options: .regularExpression) != nil && hasScheme(googleScheme) }
    private var microsoftConfigured: Bool { UUID(uuidString: microsoftID) != nil && hasScheme("msauth.\(bundleId)") }
    @objc func setup(_ call: CAPPluginCall) {
        call.resolve(["googleConfigured": googleConfigured, "microsoftConfigured": microsoftConfigured, "bundleId": bundleId,
                      "googleRedirectScheme": googleConfigured ? googleScheme : "Add the reversed iOS Google client ID", "microsoftRedirectUri": redirect])
    }
    private func finish(_ call: CAPPluginCall, _ value: [String: Any]) { active = false; call.resolve(value) }
    private func fail(_ call: CAPPluginCall, _ code: String) { active = false; call.reject("Calendar authorization could not complete.", code) }
    private func begin(_ call: CAPPluginCall) -> Bool {
        guard !active else { call.reject("Another sign-in is in progress.", "busy"); return false }
        active = true; return true
    }
    private func googleKey(_ email: String) -> String {
        SHA256.hash(data: Data((googleID + ":" + email.lowercased()).utf8)).map { String(format: "%02x", $0) }.joined()
    }
    private func acceptGoogle(_ call: CAPPluginCall, _ user: GIDGoogleUser, expected: String?) {
        guard let email = user.profile?.email, !email.isEmpty, user.configuration.clientID == googleID,
              expected == nil || email.caseInsensitiveCompare(expected!) == .orderedSame else { fail(call, "interaction-required"); return }
        let scopes = user.grantedScopes ?? []
        guard googleScopes.allSatisfy(scopes.contains), !user.accessToken.tokenString.isEmpty else { fail(call, "denied"); return }
        do {
            // The public SDK user supports NSSecureCoding. Keep each account's
            // refresh state separately; GIDSignIn.currentUser alone is single-account.
            let data = try NSKeyedArchiver.archivedData(withRootObject: user, requiringSecureCoding: true)
            try vault.put(googleKey(email), value: data.base64EncodedString())
            finish(call, ["accessToken": user.accessToken.tokenString, "scopes": scopes, "accountRef": email])
        } catch { fail(call, "unavailable") }
    }
    private func google(_ call: CAPPluginCall) {
        guard googleConfigured, let presenter = bridge?.viewController else { fail(call, "configuration"); return }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: googleID)
        if call.getBool("interactive") == true {
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: googleScopes) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self else { call.reject("Sign-in session ended.", "unavailable"); return }
                    guard let user = result?.user else { self.fail(call, (error as NSError?)?.code == -5 ? "cancelled" : "unavailable"); return }
                    self.acceptGoogle(call, user, expected: nil)
                    // Drop only the SDK singleton's local cache; per-account
                    // archives remain in our device-only Keychain. No revocation.
                    GIDSignIn.sharedInstance.signOut()
                }
            }
        } else {
            guard let email = call.getString("accountRef"), !email.isEmpty else { fail(call, "interaction-required"); return }
            // GIDGoogleUser exposes refresh-if-expired, not forced invalidation.
            // Never return the same rejected token or reach into private SDK state.
            if call.getString("rejectedAccessToken") != nil { fail(call, "interaction-required"); return }
            do {
                guard let encoded = try vault.get(googleKey(email)), let data = Data(base64Encoded: encoded),
                      let user = try NSKeyedUnarchiver.unarchivedObject(ofClass: GIDGoogleUser.self, from: data) else { fail(call, "interaction-required"); return }
                user.refreshTokensIfNeeded { [weak self] result, error in
                    DispatchQueue.main.async {
                        guard let self else { call.reject("Sign-in session ended.", "unavailable"); return }
                        guard let result else { self.fail(call, self.googleError(error)); return }
                        self.acceptGoogle(call, result, expected: email)
                    }
                }
            } catch { fail(call, "unavailable") }
        }
    }
    private func googleError(_ error: Error?) -> String {
        let value = error as NSError?
        if value?.domain == NSURLErrorDomain { return "unavailable" }
        return "interaction-required"
    }
    private func msApplication() throws -> MSALPublicClientApplication {
        if let microsoft { return microsoft }
        MSALGlobalConfig.brokerAvailability = .none
        let authority = try MSALAADAuthority(url: URL(string: "https://login.microsoftonline.com/common")!)
        let configuration = MSALPublicClientApplicationConfig(clientId: microsoftID, redirectUri: redirect, authority: authority)
        // No cross-app token sharing or broker account removal.
        configuration.cacheConfig.keychainSharingGroup = bundleId
        let app = try MSALPublicClientApplication(configuration: configuration)
        microsoft = app; return app
    }
    private func msError(_ error: Error?) -> String {
        let value = error as NSError?
        guard value?.domain == MSALErrorDomain else { return "unavailable" }
        if value?.code == MSALError.userCanceled.rawValue { return "cancelled" }
        if value?.code == MSALError.interactionRequired.rawValue { return "interaction-required" }
        return "unavailable"
    }
    private func ms(_ call: CAPPluginCall) {
        guard microsoftConfigured, let presenter = bridge?.viewController else { fail(call, "configuration"); return }
        do {
            let app = try msApplication()
            let scopes = ["User.Read", "Calendars.ReadWrite"] + (call.getBool("sharedWorkCalendars") == true ? ["Calendars.ReadWrite.Shared"] : [])
            let expected = call.getBool("interactive") == true ? nil : call.getString("accountRef")
            let complete: MSALCompletionBlock = { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self else { call.reject("Sign-in session ended.", "unavailable"); return }
                    guard let result else { self.fail(call, self.msError(error)); return }
                    guard let identifier = result.account.identifier, !identifier.isEmpty,
                          expected == nil || identifier == expected, !result.accessToken.isEmpty else { self.fail(call, "interaction-required"); return }
                    let granted = Set(result.scopes.map { $0.lowercased().replacingOccurrences(of: "https://graph.microsoft.com/", with: "") })
                    guard scopes.allSatisfy({ granted.contains($0.lowercased()) }) else { self.fail(call, "denied"); return }
                    self.finish(call, ["accessToken": result.accessToken, "scopes": result.scopes, "accountRef": identifier])
                }
            }
            if call.getBool("interactive") == true {
                let web = MSALWebviewParameters(authPresentationViewController: presenter)
                web.webviewType = .authenticationSession
                let parameters = MSALInteractiveTokenParameters(scopes: scopes, webviewParameters: web)
                parameters.promptType = .selectAccount
                app.acquireToken(with: parameters, completionBlock: complete)
            } else {
                guard let expected, let account = try app.allAccounts().first(where: { $0.identifier == expected }) else { fail(call, "interaction-required"); return }
                let parameters = MSALSilentTokenParameters(scopes: scopes, account: account)
                parameters.forceRefresh = call.getString("rejectedAccessToken") != nil
                app.acquireTokenSilent(with: parameters, completionBlock: complete)
            }
        } catch { fail(call, "configuration") }
    }
    @objc func acquire(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.begin(call) else { return }
            switch call.getString("provider") {
            case "google": self.google(call)
            case "microsoft": self.ms(call)
            default: self.fail(call, "configuration")
            }
        }
    }
    @objc func forget(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.begin(call) else { return }
            guard let reference = call.getString("accountRef"), !reference.isEmpty else { self.fail(call, "configuration"); return }
            do {
                switch call.getString("provider") {
                case "google": try self.vault.remove(self.googleKey(reference))
                case "microsoft":
                    guard self.microsoftConfigured else { self.fail(call, "configuration"); return }
                    let app = try self.msApplication()
                    if let account = try app.allAccounts().first(where: { $0.identifier == reference }) { try app.remove(account) }
                default: self.fail(call, "configuration"); return
                }
                self.finish(call, [:])
            } catch { self.fail(call, "unavailable") }
        }
    }
}
