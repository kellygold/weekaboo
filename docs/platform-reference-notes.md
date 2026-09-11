# Platform reference notes

Researched 10–11 September 2026. These notes preserve the conclusions used by the [standalone implementation plan](cross-platform-plan.md). They are not evidence that a native integration has been implemented. URLs are primary documentation. Revisit a source when selecting SDK versions, configuring an actual client, or checking changing release policies; do not repeat general architecture research each session.

## 1. Shared React and native transport

- [Capacitor documentation](https://capacitorjs.com/docs): native Android/iOS containers can host the shared web application and expose native services through plugins. This supports shared UI; it does not run the existing Python backend on a tablet or supply a complete desktop product.
- [Capacitor HTTP](https://capacitorjs.com/docs/apis/http): bundled native HTTP support can be called explicitly or configured to patch fetch/XMLHttpRequest. Patching is disabled by default. Native and browser serialization differ. The reference exposed v8 at research time; no project upgrade or plugin selection has been made.
- [Browser CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): browser JavaScript can read cross-origin responses only when the server permits it under the browser's rules. A static site or PWA does not acquire native transport privileges. Native CalDAV success does not establish pure-browser iCloud compatibility.
- [PWA architecture](https://web.dev/learn/pwa/architecture): an installed web application remains subject to web capabilities and lifecycle. PWA packaging and backend removal are separate decisions.

**Implementation conclusion:** share providers above a transport interface; test CalDAV verbs/XML/headers in native networking early. Keep browser support capability-driven. Never treat a CORS proxy as an uncosted or invisible dependency.

## 2. Google native authorization

### Android

[Authorize access to Google user data](https://developer.android.com/identity/authorization) documents Google Identity Services AuthorizationClient. API authorization is separate from app sign-in/Credential Manager. A request can return access or require a user resolution; the native layer must handle both. Configure an Android OAuth client using the actual package/signing identity. Account selection and granted scopes belong in the authorization result.

**Important correction preserved:** do not implement Google Android by copying desktop loopback OAuth, inventing a `weekaboo://` Google redirect or embedding the existing web client secret. Use the supported Android SDK flow. Request a usable access token through the adapter; do not require that shared code owns a refresh token.

### iOS and desktop

[Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app) documents installed-app credentials, PKCE and supported return mechanisms. Google recommends its SDK on iOS; register the bundle ID and provider-specific URL scheme. A desktop app can use a temporary loopback listener. Mobile loopback support is deprecated; arbitrary custom URL schemes are not supported for Google Android authorization.

**Implementation conclusion:** the shared Google Calendar client need not know which mechanism produced its credential. Official builds have platform-specific client registrations; installations reuse those registrations. A fork with a different package/signature/bundle identity may need new registrations.

### Existing backend and public release

- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server): the existing development server's callback/client is a different application type. Its localhost callback is not a universal native redirect.
- [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies): use separate appropriate platform clients and separate testing/production projects. Public production apps require a verified-domain homepage with functionality, privacy-policy and terms links, plus applicable scope/brand verification. Use the system authorization experience, not an embedded WebView login. These requirements do not imply a runtime backend. Inject official build configuration at build time; do not publish secrets or copy the current credential files into source.
- Existing historical research identified short-lived refresh tokens for external apps left in Testing with calendar scopes. Verify actual consent publishing status and SDK behavior before calling a connection suitable for unattended use; do not promise indefinite access.
- [Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth): choose discovery and event scopes based on actual read/write features. Avoid Gmail/contact scopes for a calendar client.

No native client registration, bundle/package ID, signing certificate, scope audit or public-verification status has been confirmed by this documentation task. These are targeted configuration tasks, not reasons to research OAuth from scratch.

## 3. Microsoft native authorization and account types

- [OAuth authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow): public/native and SPA flows differ from confidential-server flows; use PKCE and supported libraries rather than a bundled server secret.
- [MSAL Android configuration](https://learn.microsoft.com/en-us/entra/msal/android/msal-configuration): Android redirect configuration typically uses `msauth://<package>/<signature>`. App configuration, manifest handling and registered signing identity must agree. Debug/release signing can require distinct registered redirects.
- [MSAL iOS/macOS redirects](https://learn.microsoft.com/en-us/entra/msal/objc/redirect-uris-ios): typical return URI is `msauth.<bundle-id>://auth`; follow SDK and application URL configuration.
- [MSAL desktop system browsers](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/using-web-browsers): desktop loopback is a supported pattern in relevant SDKs. This .NET source establishes the pattern, not a choice to use .NET in Weekaboo. Validate the selected TypeScript desktop auth implementation separately.

**Account distinctions already learned:** a personal Hotmail/Outlook account can use calendar access without becoming an organizational account. An Entra directory was needed for developer app registration, not to convert every end user's mailbox. The app audience must support personal Microsoft accounts as well as organizational accounts when both are intended. Organization policy can still require admin approval.

The implemented backend supports normal calendar consent and an optional shared-work-calendar flow. Personal and organizational scopes/audiences are not interchangeable. Maintain `Calendars.ReadWrite` for personal access and request shared-work permissions where supported/needed; do not simply require every scope for every account. See [existing Microsoft integration](microsoft-calendar.md) for current backend behavior and configuration. Register native platforms separately without breaking development web OAuth.

MSAL can manage its own token cache. Shared code should request valid authorized access, not dictate the cache format or copy opaque SDK records into exported tasks. Removing a local Weekaboo connection is different from signing the user out of Microsoft globally or revoking all grants.

## 4. iCloud and the alternative system-calendar approach

The current implementation uses direct CalDAV and an app-specific password. It is not Sign in with Apple; there is no OAuth callback in this flow. Apple also documents Apple Account authorization for some supported third-party apps; eligibility and developer integration for Weekaboo have not been established. Do not claim app-specific passwords are the only possible Apple integration forever, or change our selected baseline without a bounded assessment. Preserve that user experience with secure on-device credential handling, native TLS transport, collection discovery and conditional writes.

- [Apple app-specific passwords](https://support.apple.com/en-us/102654): reference for the user's credential creation/revocation workflow. Do not ask for the primary Apple Account password.
- [Android Calendar Provider](https://developer.android.com/identity/providers/calendar-provider): applications can access device calendar data with appropriate permissions; sync adapters populate that store.
- [Apple EventKit access](https://developer.apple.com/documentation/eventkit/accessing-calendar-using-eventkit-and-eventkitui): native calendar access is possible through system permissions.

**Decision:** using the system calendar database is an alternative considered, not the chosen integration baseline. Direct providers give more consistent behavior across installed targets and do not depend on whether another app populates the device calendar store. Do not mix both sources for the same calendar and double-import events. An optional system-calendar adapter may be considered later, without duplicating core rules.

**Unproven:** fresh native iCloud authentication/CalDAV on the new transport; equivalent pure-browser operation. Existing Python-to-iCloud success and tablet access through the Mac do not prove either.

## 5. Provider data correctness references

- [Google versioned resources](https://developers.google.com/workspace/calendar/api/guides/version-resources): preserve ETags and conditional operations to detect intervening changes.
- [Google event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert): use correct time-zone/recurrence fields and verify supplied event-ID requirements before adopting deterministic create identities.
- [Microsoft event update](https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0): online meeting body details must survive updates. This is why the current editor preserves provider-generated meeting blocks.
- [Unicode Windows/IANA mapping](https://github.com/unicode-org/cldr/blob/main/common/supplemental/windowsZones.xml): existing territory-001 mapping is bundled and attributed; preserve its license when porting.

The existing adapter source and test cases contain more specific learned behavior than an API introduction. Use [implementation handoff](implementation-handoff.md) for file names and live evidence. The stale-write/DST fixes are complete in Python; ambiguous-create retry remains incomplete. Do not mistakenly reintroduce the four fixed defects or report them as still failing based on the old audit.

## 6. Lifecycle

[Android PeriodicWorkRequest](https://developer.android.com/reference/androidx/work/PeriodicWorkRequest) documents a minimum periodic interval and inexact execution affected by system constraints; historical research established a 15-minute minimum for periodic work. This is not the foreground calendar refresh interval. A native wrapper does not grant unlimited background runtime. Use foreground/resume synchronization and opportunistic background work; select equivalent iOS scheduling behavior during native implementation.

## 7. Static publication and cost evidence

Facts below were checked on 11 September 2026. Costs, eligibility and enforcement can change; verify them at enrollment/release rather than treating saved documentation as an authorization to spend.

| Source | Finding and consequence |
|---|---|
| [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | Static hosting is available for public repositories with GitHub Free; supports a custom domain. Suitable for the public project site, not the Python API. |
| [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Size/bandwidth/build and permitted-use constraints apply. Keep downloads in release assets and avoid treating Pages as a SaaS backend or checkout host. |
| [Apple enrollment](https://developer.apple.com/programs/enroll/) | Standard Apple Developer Program costs US$99 per membership year, with regional pricing; limited fee-waiver eligibility exists. Open-source hobby status alone is not an established waiver. |
| [Apple developer account overview](https://developer.apple.com/help/account/basics/about-your-developer-account) | Free Personal Team development installations require periodic reprovisioning; profiles expire after seven days. This is not a durable public iPhone distribution method. |
| [Play Console setup](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) | US$25 one-time registration; account verification and testing requirements also apply. Play listing is optional, not already selected. |
| [Android developer verification](https://developer.android.com/developer-verification) | Free limited distribution for up to 20 devices is documented. The page describes a September 30, 2026 regional milestone for participating stores in Brazil, Indonesia, Singapore and Thailand and global expansion from 2027. Do not generalize this into all downloads being blocked today or unlimited free distribution forever. Follow the appropriate outside-Play/advanced-flow guidance at release. |

Unresolved cost items: desktop signing/notarization for the chosen release route; existing Apple/Google memberships; current release asset/CI allowances; generated audio redistribution rights under the account/plan used to create it. No enrollment, paid plan, hosting resource or purchase was performed.

The zero-cost target is a product constraint, not a claim that every store waives its fee. Keep the app operational without developer-hosted services, choose no-cost channels where workable, and explicitly defer incompatible distribution channels until Kelly decides otherwise.

## 8. What does not need re-research, and what does

Established architectural facts: native apps can connect directly; callback mechanisms vary; Google Android requires its native authorization approach; desktop loopback is local; iCloud app-password CalDAV has no OAuth redirect; browser transport is a separate constraint; tasks require their own cross-device mechanism; React can remain shared.

Targeted implementation validation still required: exact plugin maintenance/license/version, native request and storage behavior, chosen desktop SDK compatibility, provider console values and public consent readiness, distribution rights/costs at release. Record discoveries beside these notes with date, selected versions and test evidence. Never store credentials, auth codes or signing material here.

## 9. Existing Apple signing setup and native distribution targets

Follow [user dependencies](user-dependencies.md) for the 11 September read-only inventory of Paper In's signing workflow, local certificate types, Xcode selection and device availability. Existing Developer ID Application signing is relevant to the future Mac DMG; iOS needs Apple Development/Distribution and its own App ID/profiles. See [Apple certificate types](https://developer.apple.com/help/account/certificates/certificates-overview/) and [App ID registration](https://developer.apple.com/help/account/identifiers/register-an-app-id/). Do not automatically create a second paid membership or revoke an existing certificate.

Native Capacitor Android/iOS packages can be prepared for store submission; PWA installation is optional and not the mobile deliverable. Android first, iOS second, macOS DMG third is the updated delivery order. All remain on the shared product/core architecture. Actual store approval and production browser-provider parity are separate evidence gates.

## 11 September native implementation evidence

Read [standalone progress](standalone-progress.md) for pinned dependencies, actual build/device results and failures. CapacitorHttp on the tested Android runtime **rejects PROPFIND**; the selected Android transport now uses OkHttp 5.3.2 (Apache-2.0), with redirects and automatic connection retries disabled. XML/header/unauthenticated CalDAV transport tests pass; authenticated native provider support remains unproven. SDK/library versions were checked against installed package metadata and [OkHttp Maven metadata](https://repo.maven.apache.org/maven2/com/squareup/okhttp3/okhttp/maven-metadata.xml).

The Android vault uses [Android Keystore](https://developer.android.com/privacy-and-security/keystore), AES-GCM and reference-bound additional data; backup configuration follows [Android Auto Backup exclusions](https://developer.android.com/identity/data/autobackup). `loggingBehavior: none` disables Capacitor's otherwise token-bearing plugin argument logs. These are implementation choices, not guarantees against a compromised running app or unlocked shared device.

## 11 September task file portability

Selected user-driven system file exchange, not a hosted sync service. Android uses [Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files) OPEN_DOCUMENT/CREATE_DOCUMENT, no broad storage permission, temporary chosen-URI grants and bounded UTF-8 streams. CREATE_DOCUMENT does not overwrite an existing same-name backup. iOS adapter source uses [UIDocumentPickerViewController](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller), security-scoped coordinated reads and temporary app-private export copies; compilation/runtime still pending Xcode. Browser uses file input and Blob download. All adapters feed the same versioned task service validation, preview and atomic merge. No credentials are transferred.

### 11 September timezone bundle and recurrence creation

Do not adopt @touch4it/ical-timezones 1.9.0 (2018g data). Instead, `src/engine/data/vtimezones.json` pins tzurl's 340 **IANA 2026c** VTIMEZONE definitions plus aliases from the matching immutable IANA release. `scripts/update-timezone-data.py --version 2026c` validates each TZID/release and reads named IANA archive members without extraction. This is an explicit maintainer update; app builds/runtime never fetch timezone data. `licenses/IANA-timezone-data.txt` retains the upstream public-domain notice. No tzurl/vzic GPL generator code is incorporated.

Bundle SHA-256: `b73ba11d3f29049e9d978d5ca9c834f4fdd43712c9c82fa6ee1c86c398556b4b` (661,387 bytes). The bundle also records the IANA source archive URL/hash. Sources: [IANA release archive](https://data.iana.org/time-zones/releases/tzdata2026c.tar.gz), [license](https://data.iana.org/time-zones/tzdb/LICENSE), [tzurl zoneinfo](https://www.tzurl.org/zoneinfo/), [iCal4j timezone documentation](https://www.ical4j.org/timezones/). Generator provenance is [tzurl](https://github.com/benfortuna/tzurl); output data and generator code have different licensing.

`node scripts/verify-timezone-data.mjs` parses all definitions and compares eight sample instants per supported zone to installed ICU. Local ICU 76.1/tz2024b differs for Morocco/Western Sahara, Paraguay, Edmonton and Vancouver; all correspond to newer [IANA NEWS](https://data.iana.org/time-zones/tzdb/NEWS) changes (2025a/2025b/2026b/2026c). `America/Coyhaique` is absent from the older ICU. Receipt: `output/standalone-icloud/timezone-verification.json`. The comparison script fails on parse errors; differences require review, not automatic acceptance. UI formatting still uses OS/Intl timezone data and can differ on outdated devices; the bundle governs emitted iCloud recurrence definitions, not every platform's date formatter.

New iCloud repeats use a resource-scoped VTIMEZONE and preserve the supplied instant/local recurring hour across DST. No global ICAL registry mutation or unknown-zone UTC fallback. Editor patterns daily/weekly/monthly/yearly, positive interval/count and valid date/UTC UNTIL are supported; other newly authored selectors fail explicitly. Existing custom recurring resources remain readable and individually editable. Whole-series modification/removal is still pending. Conditional stable resource creation and UID-checked reconciliation work even when a series has ended or its first occurrence is cancelled.

## 11 September Apple SDK source integration

Selected exact **GoogleSignIn 10.0.0** and **MSAL 2.15.0** package references in the Xcode project (outside Capacitor's regenerated package). Checked pinned public headers and manifests; local references in `output/standalone-ios/sdk-reference`. Google package requires Swift 6 and iOS 15; selected MSAL binary requires iOS 17/macOS 14, so this app's iOS target is now 17. Package resolution/compilation still await full Xcode; commit a validated transitive Package.resolved before a reproducible release.

- [Google 10.0.0 package](https://github.com/google/GoogleSignIn-iOS/blob/10.0.0/Package.swift), [GIDGoogleUser public API](https://github.com/google/GoogleSignIn-iOS/blob/10.0.0/GoogleSignIn/Sources/Public/GoogleSignIn/GIDGoogleUser.h), [implementation](https://github.com/google/GoogleSignIn-iOS/blob/10.0.0/GoogleSignIn/Sources/GIDGoogleUser.m): NSSecureCoding and refresh-if-needed are public. Shared singleton holds only the current account. Our adapter archives each user separately in device-only Keychain, persists refresh results, and clears singleton local state after connection. Multi-account restart/refresh and SDK archive compatibility require real proof. Do not switch to the singleton-only cache. A rejected unexpired token returns reconnect-required; do not pretend SDK refresh-if-needed invalidates it or reach into private SDK state.
- [MSAL 2.15.0 package](https://github.com/AzureAD/microsoft-authentication-library-for-objc/blob/2.15.0/Package.swift), [public application API](https://github.com/AzureAD/microsoft-authentication-library-for-objc/blob/2.15.0/MSAL/src/public/MSALPublicClientApplication.h), [cache configuration](https://github.com/AzureAD/microsoft-authentication-library-for-objc/blob/2.15.0/MSAL/src/public/configuration/publicClientApplication/cache/MSALCacheConfig.h): use `common`, personal+organization registration, per-account silent grants and force refresh after rejection. **Private cache group is the bundle ID, not nil** per pinned header. Broker disabled; system authentication session selected. Disconnect uses account cache removal, not browser/global signout.
- Native callback handling delegates to each SDK before Capacitor. Google URL scheme is the reversed iOS client ID, Microsoft is `msauth.app.weekaboo.calendar://auth`. Public client configuration is in `ios/native-auth.xcconfig`; no native client secret. Wrong identity/scopes fail closed, native errors are translated into fixed messages, token data is never logged by the app.

Shared `NativeSdkAuthorization` now owns serialization and safe errors for both Android and Apple; platform subclasses provide only typed setup. Existing Android consent-negative/cancellation proof must remain passing after this extraction. This source is not a production iOS result: full Xcode, SDK resolution, archive/Keychain/lifecycle and actual consent remain acceptance gates.

## 11 September macOS container and authorization decision

**Electron 44.3.0**, **@electron/packager 20.3.0**, **MSAL Node 6.0.0**, **google-auth-library 11.0.2**, and **esbuild 0.28.2** are pinned. Electron runs the existing React/TypeScript engine; no Swift/Rust provider engine or Python bundle. The larger embedded Chromium runtime is the tradeoff for keeping the native desktop integration in TypeScript/Node. This resolves the earlier Electron/Tauri investigation for the macOS MVP. Android/iOS remain Capacitor; iOS does not depend on Electron.

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) and [sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox/): contextIsolation, sandbox, no Node in renderer, no webviews, denied permissions, fixed app protocol/CSP, main-frame IPC allowlist, HTTPS external links only. Plain error envelopes are required because contextBridge drops custom Error properties. Main-process CommonJS is bundled separately from the renderer; dependencies never enter the web UI.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): app-private SQLite stores encrypted credential envelopes bound to their reference. Real Mac proof explicitly disables Playwright's mock Keychain flag. SDK cache uses a separate database and larger bounded encrypted record; neither is part of task backups. Missing OS encryption fails closed. Native request layer uses Node HTTPS with no redirects/retries/cookies, strict destination lists, total timeout and response limits.
- [Microsoft's Electron tutorial](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-v2-nodejs-desktop), [public-client initialization](https://learn.microsoft.com/en-us/entra/msal/javascript/node/initialize-public-client-application), and [MSAL Node source](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node): use MSAL Node public client, common authority, system browser, S256 PKCE. Our bounded loopback receiver supplies the code to the SDK. Native app registration must include **Mobile and desktop applications → `http://localhost`**. Actual receiver uses an OS-selected port and `/`; no internet callback/server. The SDK cache is deserialized per operation and persisted only after account/scope checks. Silent acquisition selects homeAccountId, with forceRefresh after a rejected access token. Local disconnect removes only that account. Synthetic MSAL-client tests are not real SDK consent/multiaccount proof.
- [Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app?hl=en), [loopback migration](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration), [Google Node library](https://github.com/googleapis/google-auth-library-nodejs): create **Desktop app** credentials, distinct from Web/Android/iOS. Desktop loopback remains supported; mobile loopback does not. System browser and random `127.0.0.1` port with S256 PKCE/state. Google may supply a `client_secret` in installed-client JSON; the installed app is a public client and cannot keep that parameter confidential. This is never permission to embed the existing web-server secret. Current documentation labels it optional: `clientSecret` may be empty in the config; live native registration must prove whether that client's exchange accepts omission. Any supplied value is embedded in the native package, never printed or inserted in renderer settings.
- Desktop Google uses SDK token exchange/refresh/introspection with bounded request hooks. Audience, immutable subject and calendar/email scopes are checked before persisting a per-client/per-subject record. Rejected cached tokens force refresh; account mismatch retains prior storage. Two-account/restart/forced-refresh tests use the actual Google library with synthetic HTTP. OpenID/email/calendar requested; no contact/mail permissions.
- Loopback receiver binds only `127.0.0.1`, validates Host/path/state, rejects duplicate code/error parameters, has a five-minute lifetime, no app/API routes, no URL/token logging, and closes on cancel/failure/success. Closing the Mac window cancels pending consent. No persistent local server or network dependency is introduced. New app process lock prevents simultaneous workers using one profile. A CLI `--user-data-dir` creates isolated test profiles through Electron; proofs assert the realpath before any write.
- Development `.app` is **arm64 ad-hoc only**, not a hardened Developer ID or notarized release. An attempted hardened ad-hoc launch failed dyld library validation despite codesign verification; development package disables hardened runtime and strips unneeded default device entitlements. Developer ID signing must rebuild/re-sign every nested component, enable hardened runtime with justified entitlements, validate launch, then notarize/staple and test install/update separately. No public distribution approval is implied.

Evidence: `output/standalone-desktop/`. Startup, task restart, OS vault, native iCloud unauthenticated request and packaged task save pass; full live native provider consent/write matrix is pending. Native registration config is ignored `desktop/native-auth.json`; tracked `.example` contains placeholders. SDK and Electron notices are copied into the local app archive; frontend/mobile transitive and generated-asset rights audit remains a public-release gate.

Developer ID follow-up: the existing team certificate successfully signed the local app and all nested components with hardened runtime and only the required JIT entitlement. Strict signature verification and isolated packaged task-save passed; signed DMG integrity/signature verification passed too. The earlier ad-hoc mismatch is not a Developer ID blocker. Notarization/stapling, release fuses/entitlement audit, Gatekeeper/install/update and actual native account tests remain open. No Apple submission or release occurred. See signed receipts in `output/standalone-desktop`.

## Local validation tools — 11 September 2026 continuation

- Physical iPad: pymobiledevice3 **11.6.0** in isolated ignored `output/ios-tools-env`; `webinspector cdp --host 127.0.0.1 --port 9223 --udid <connected-iPad-UDID>`. Web Inspector must be enabled under Settings → Apps → Safari → Advanced. Remote Automation is not required. Connect Playwright over CDP; filter to exactly one capacitor://localhost target and require Weekaboo title + iOS platform before interacting. Native credentials stay in WebView memory. Inspector reattachment once returned incomplete target identity; preflight stopped without mutation. Relaunch/restart bridge rather than weakening target checks. Guide: https://github.com/doronz88/pymobiledevice3/blob/master/docs/guides/webview-debugging.md .
- Android bundletool **1.18.3**, downloaded from the official `google/bundletool` release, SHA-256 checked against release asset metadata. Tool and receipt in ignored `output/android-tools/`. `validate` accepts the current signed AAB; `build-apks --mode=universal` using the existing release keystore produces a verified signed APK. Password supplied as a **file path**, never command-line text. This does not substitute for Play upload or device installation. References: https://developer.android.com/tools/bundletool and https://github.com/google/bundletool/releases/tag/1.18.3 .
