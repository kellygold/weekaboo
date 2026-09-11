# Privacy disclosure preparation

Initial iOS review: 11 September 2026 against source `d824b4d` and its App Store distribution export. Android SDK follow-through: 12 September 2026, exact locked dependencies described below. This is the engineering evidence sheet for preparing store answers, not submitted labels. Canonical website policy source is `website/legal/privacy-policy/index.html` (`website/privacy.html` is the legacy route). No Weekaboo service receives app data; calendar providers still receive authentication and synchronization traffic. Local task storage and provider calendar storage must be described separately.

## Data flows shared by the native apps

| Data | Processing and recipient | Purpose / linkage | Retention and disclosure status |
| --- | --- | --- | --- |
| Tasks, completion history, preferences | Local repositories and device database. Explicit task export writes a user-selected file. | App functionality, local task identity. | No automatic Weekaboo upload or task sync. Exported copies remain until their owner deletes them. Local-only handling is distinct from provider calendar handling. |
| Calendar titles, times, descriptions, locations and attendees | Shared provider engine sends reads/writes directly to Google Calendar, Microsoft Graph or iCloud CalDAV. Local calendar cache supports offline viewing. | App functionality, linked to the selected provider account. | Provider owns remote persistence and policy; removing a local connection does not delete remote events. Assess free-form event content and attendee information in store answers. An event venue is not evidence of GPS collection. |
| Account email, name, provider/account IDs | Provider authorization and calendar discovery; local account metadata. | Account selection and app functionality; linked to provider identity. | Local metadata plus provider account records. No Weekaboo account database. SDK declarations below also apply. |
| Credentials and refresh/access tokens | Native protected stores and authorization SDK caches; sent to their corresponding provider as needed. | Authentication, linked to provider account. | Local secure storage is covered in [credential review](credential-security-review.md). No distributed confidential OAuth secret is needed for native public clients. |
| Connection IP, authentication environment and diagnostics | Provider authorization/network endpoints, including native SDK requests. | Authentication/security and vendor-declared purposes. | Provider retention and exact category applicability need vendor-specific assessment; no assertion that all traffic is ephemeral. Absence of a Weekaboo backend does not remove this question. |
| Meeting/map links | Opened on deliberate user action with the relevant external service. | Joining a meeting or locating an event. | External service policies apply. This does not establish background location tracking. |

## Platform-specific evidence

| Platform | Authorization implementation | Verified privacy controls | Remaining disclosure proof |
| --- | --- | --- | --- |
| Android | Native Google authorization and MSAL; shared CalDAV engine for iCloud. SDK runtime versions locked in `android/app/gradle.lockfile`. | Release logging/inspection disabled; private credentials and backup exclusion reviewed; no app-owned analytics service. | Review pinned Android SDK data-safety guidance against actual options. iOS declarations are not a substitute. Play App Signing and store delivery remain separate gates. |
| iOS/iPadOS | GoogleSignIn 10.0.0, MSAL 2.15.0 and ten locked Swift packages; shared CalDAV engine. | No app-installed MSAL telemetry or log callback; PII telemetry default off. Google optional wrapper identifier and App Check configuration are unused. Twelve SDK manifests retained. | See vendor declarations and open questions below; obtain final archive privacy report and review exact App Store answers. |
| macOS | Browser-based public-client OAuth through Google auth library and MSAL Node, using native loopback callbacks; shared CalDAV. | Protected native stores, Microsoft PII logging disabled, no app-owned analytics service. | Assess pinned Node SDK diagnostics and external authorization service practices separately. Native iOS manifests do not describe Electron behavior. |
| Browser | Optional loopback Python backend, distinct from native packaging. | Backend secrets encrypted locally; no public hosted deployment approved. | Do not apply standalone-native storage claims to an arbitrary self-hosted server. Review separately before any hosted offering. |

## Android pinned SDK review — 12 September

This bounded source/binary inspection uses Google `play-services-auth:22.0.0`, MSAL `8.4.2`, Microsoft common/common4j `24.6.0`, and YubiKit Android `2.5.0`, matching `android/app/gradle.lockfile`. Published Microsoft/Yubico source JARs were downloaded and hashed privately. The common4j source JAR contains only BuildConfig, so its implementation was inspected at upstream tag `v24.6.0`, commit `6d38cd35d40aca36d9c26b37ecad4959b614e2c5`, and key behaviors were cross-checked against the **actual cached compiled common4j JAR** using `javap`. No device traffic, tokens or account content were intercepted.

### Microsoft: confirmed behavior, not a blanket telemetry claim

The normal OAuth token-request implementation adds a correlation ID, library name/version, application package/version and platform information, then POSTs these headers to its token endpoint. Android platform values include CPU architecture, OS/API level, device model and manufacturer. This path is independent of Weekaboo's disabled PII/logcat logging. The metadata is sent with authentication traffic; no separate Weekaboo analytics endpoint is involved. [Pinned token request implementation](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common4j/src/main/com/microsoft/identity/common/java/providers/oauth2/OAuth2Strategy.java#L209), [platform fields](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common4j/src/main/com/microsoft/identity/common/java/platform/Device.java#L103), [Android values](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common/src/main/java/com/microsoft/identity/common/internal/platform/AndroidDeviceMetadata.java#L50).

Two optional telemetry mechanisms are distinguishable from those request headers:

- MSAL's application event telemetry is disabled when its configuration is null. Weekaboo supplies no telemetry configuration or observer; the pinned constructor and flush guard confirm the disabled path. It is incorrect to infer enabled event analytics just because telemetry classes and device fields are packaged. [Pinned telemetry guard](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common4j/src/main/com/microsoft/identity/common/java/telemetry/Telemetry.java#L81).
- The pinned OpenTelemetry holder starts with a no-op implementation. No Weekaboo exporter, holder override or observer registration was found. The transitive OpenTelemetry API dependency does not, by itself, establish off-device span collection. [Pinned default](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common4j/src/main/com/microsoft/identity/common/java/opentelemetry/OpenTelemetryHolder.java#L60).

The archive also contains historical current/last-request telemetry schema classes. This inspection did **not** establish that their error-history headers are emitted by the configured current path; do not turn those schema definitions into an affirmative collection claim. Conversely, the confirmed ordinary request headers remain present even with optional telemetry disabled. No supported disable-all-provider-diagnostics setting was established. Provider-side logging, retention and secondary use cannot be proven from client code.

Weekaboo configures MSAL MULTIPLE accounts, BROWSER authorization, broker redirect registration false, PII/logcat false and ERROR logging. It requests profile/calendar permissions and conditionally shared-calendar access. Bearer token flows are used; the mere presence of PoP keys, broker registration/device identity, native-auth phone/SMS, or Intune-related classes does not mean Weekaboo enables them.

### NFC / YubiKit is conditional certificate authentication

The actual merged release manifest contains Internet, network state, the app's non-exported receiver permission, and **NFC**. The merger attributes NFC to YubiKit Android `2.5.0`. `allowBackup=false`; release debugging is disabled.

Microsoft common uses YubiKit for smartcard certificate-based authentication. Its NFC discovery is entered from the certificate-authentication flow, not calendar refresh. Weekaboo normally selects an external browser. However, the pinned strategy factory falls back to embedded WebView when no eligible browser exists, even when BROWSER is configured; that WebView can create the certificate-authentication handler. Therefore NFC is not an app-owned calendar feature, but it cannot be declared unreachable on every device. [Strategy fallback](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common/src/main/java/com/microsoft/identity/common/internal/ui/AndroidAuthorizationStrategyFactory.java#L83), [conditional smartcard discovery](https://github.com/AzureAD/microsoft-authentication-library-common-for-android/blob/6d38cd35d40aca36d9c26b37ecad4959b614e2c5/common/src/main/java/com/microsoft/identity/common/internal/ui/webview/certbasedauth/CertBasedAuthFactory.java#L165).

Permission presence is not proof of NFC tag data upload. The optional certificate-authentication case needs its own provider/security description if supported publicly. No NFC permission or dependency was removed in this review: doing so could break a corporate login path and requires a separate implementation decision and validation.

### Google: app boundary proved; service-side disclosure still unavailable

Weekaboo calls AuthorizationClient with Calendar, email and OpenID scopes, selects an existing Google account or prompts for one, then uses the resulting token. The shared identity reader retains `sub` and verified `email`, not a phone number or profile name. No app-owned location, phone-number or SMS API call was found in this path. Optional auth-api-phone/FIDO libraries are not proof those features execute.

The exact Google sources JAR URL returned 404. Inspection of the cached 22.0.0 AAR proves `Identity.getAuthorizationClient` instantiates the packaged implementation, whose authorize method delegates through GoogleApi/RemoteCall and sets method key `1534`. That shows a service boundary and instrumentation identifier, **not** what the separately installed Google Play services process sends, how long Google retains it, or whether the key results in uploaded analytics on a given installation. Do not infer zero collection or a complete telemetry taxonomy from this client stub. [Google AuthorizationClient API](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationClient), [Android authorization integration](https://developer.android.com/identity/authorization).

The general Play-services core disclosure covers its named base/basement/tasks libraries; it is not an AuthorizationClient-specific category declaration. No primary vendor document found in this bounded review supplies a complete 22.0.0 AuthorizationClient Data safety matrix. Google Sign-In for iOS and Firebase Authentication are different SDK surfaces and must not be substituted. [Core disclosure boundary](https://developers.google.com/android/guides/play-data-disclosure).

### Concrete Play form mapping

These are engineering recommendations based on the app and pinned behavior, not submitted answers. Collection includes applicable off-device SDK processing; a user-initiated sharing exception does not erase collection. Local-only handling is distinct. [Play definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

| Play category / question | Current evidence and recommended answer basis |
| --- | --- |
| Calendar events | **Collected: yes, prepare declaration.** Event content is read/written to connected providers for app functionality. Linked to the provider account; optional to connecting/using a calendar. Do not mark ephemeral: provider events persist. Cover guest/venue/free-form event information in the calendar flow rather than pretending those fields never leave device. |
| Personal info → Email address; User IDs | **Collected: yes, prepare declaration.** Provider identity and account selection use email/subject/account identifiers. Purposes: app functionality and account management; account-linked and optional to connection. |
| App info and performance → Diagnostics | **Prepare a collected declaration for Microsoft authentication environment/request diagnostics**, based on the confirmed metadata headers. App functionality/account-security purpose is supported by the path. Do not assert anonymous, ephemeral or analytics-only. Vendor retention/secondary analytics and Google's additional diagnostic fields remain unresolved. |
| Device or other IDs | **Unresolved vendor boundary.** Model/manufacturer/API level and a request correlation ID do not alone prove collection of a persistent device identifier. No Weekaboo advertising ID use was identified. Google's service-side identifiers and conditional Microsoft device-authentication paths need specific evidence; do not mechanically tick or omit the category. |
| Approximate / precise location | No app location permissions/API use in the inspected path; event venue is not GPS. Providers necessarily see connection IP, but whether/why they derive and retain location for this integration is not established. **Do not declare GPS collection from venue text; keep vendor IP-derived location unresolved.** |
| Phone number | No Weekaboo phone/SMS API use found. Optional dependency classes do not justify an unconditional declaration. Phone entered into a provider's own login/MFA or conditional auth flow must be assessed separately; absence of app permissions does not prove the provider never receives one. |
| Name / Contacts | Account metadata readers retain email/subject; event guest names/addresses are calendar content. No address-book permission/access was found in this lane. Assess the provider login/identity SDK flow rather than blindly copying the iOS Name/Contacts categories. |
| App interactions / analytics | No app-owned analytics, MSAL observer or OpenTelemetry exporter configured. The optional Microsoft event telemetry path is disabled; do not add interaction analytics solely because its classes exist. Google's service-side method instrumentation and vendor purposes remain unconfirmed. |
| Local tasks/preferences | No automatic off-device task upload by Weekaboo. Explicit file export is user-directed; provider events are a separate data flow. |
| Sharing, deletion, encryption | Assess applicable provider-transfer exceptions individually; providers are not automatically Weekaboo processors. App-owned provider requests use HTTPS. Local removal differs from deleting remote events and revoking grants. Vendor retention and SDK paths must be included before final answers. |

This evidence closes the earlier blanket uncertainty about **whether Microsoft sends any diagnostic environment metadata** (it does) and **whether MSAL optional event/OTel collection is enabled by merely including the SDK** (not with the inspected configuration). It does not close Google service internals, provider retention or all conditional login paths.

### Irreducible questions and exact next action

Engineering should seek a version/API-specific vendor answer or the SDK's maintained Play Console disclosure entry for these questions before final submission:

1. For AuthorizationClient in `play-services-auth:22.0.0` with only Calendar/email/OpenID authorization and no Firebase/SignInClient/phone/location API calls, which device IDs, diagnostic/interaction fields or IP-derived location are collected by Google Play services, for what purposes and retention? Which are optional or controlled by device settings? Does method-key instrumentation alter the answer?
2. For MSAL `8.4.2` with common `24.6.0`, BROWSER/MULTIPLE, no broker redirect, no optional telemetry config/observer/exporter and logging disabled, what retention and secondary purposes apply to token-request metadata? Which additional data applies to browser fallback and optional smartcard/conditional-access authentication?

These are prepared questions, not messages sent to vendors. A safe synthetic instrumentation check may supplement the answer, but cannot prove universal non-collection, all provider configurations or server retention. Do not intercept personal credentials to manufacture certainty. No immediate paid service or replacement OAuth registration is needed.

Private source URLs, SHA-256 receipts, compiled-method evidence and inspection summary: `output/production-validation/android-sdk-privacy-20260912/`. Store answers remain unsubmitted; use this section to refine [Android submission packet](android-release-submission.md), not to bypass its remaining gates.

## iOS SDK declarations and actual configuration

Google's packaged manifest declares eight linked categories: name, email address, phone number, other data, coarse location, user ID, device ID and other usage. Some purposes include analytics. Microsoft's declares name, email, other contact, customer support, user ID, device ID and other diagnostics as linked, plus phone as unlinked, for app functionality. These are vendor declarations across SDK capabilities, not a runtime trace proving every category is sent by Weekaboo.

Pinned Google implementation adds SDK version (`gpsdk`) and execution environment (`gidenv`) to authorization/token requests. Optional `gidwrapper` is not set. App Check token use is gated on configuration that Weekaboo does not call. Microsoft's optional application telemetry callback is unset, but IdentityCore still supplies authentication request telemetry headers. No supported disable-all-provider-diagnostics switch was found; do not silently fork SDK networking to remove it.

All twelve packaged manifests declare tracking false with no tracking domains. Relevant SDKs declare UserDefaults reason codes CA92.1, 1C8F.1 and C56D.1. A bounded review of 77 app-owned Swift/TS/JS files plus native symbol checks found no concrete missing app-owned required-reason declaration. This is not a complete dynamic call graph or a guarantee of App Store approval. Do not add an empty root manifest merely to make a checklist look complete.

## Repeatable package gate

`python3 scripts/verify-ios-privacy.py /path/to/App.app` compares the exact resource set and semantic plist digests with the reviewed `ios/privacy-baseline.json`, and ties it to locked package revisions. XML versus binary encoding is allowed; added, removed, malformed or changed declarations fail. `scripts/ios-release.py` now runs this check on the exported IPA and retains the full declaration inventory in its private receipt directory.

Changing a dependency or adding an app-owned manifest requires reviewing its data/API behavior and deliberately updating the baseline. Never regenerate it automatically to clear a failed build. Preserve vendor manifests; the inventory must not rewrite or strip declarations. Run `python3 scripts/verify-ios-privacy.test.py` to exercise missing/changed/new resource, SDK revision, encoding and unsafe-path failures.

## Remaining submission decisions

- Map actual calendar content/account flows and SDK categories to each store's taxonomy. In particular, resolve optional phone, location, device ID, usage and diagnostic category applicability and provider retention from pinned vendor guidance. Do not ask Kelly to guess and do not equate event venue text with device geolocation.
- Export Xcode Organizer's aggregate privacy report from the final archive. Reconcile it with actual enabled SDK behavior; neither a blind union nor a blanket “Data Not Collected” answer is justified.
- Complete the remaining Android vendor-boundary questions listed above; pinned local SDK/source inspection and concrete draft mapping are now recorded.
- Present final policy, store answers and publication destinations together for Kelly's approval. No immediate new account registration or payment is required.

Apple includes third-party SDK practices in its disclosure requirements and distinguishes local-only processing from retained off-device data. Recurring calendar sync is core functionality; initial opt-in alone does not make all later data optional to disclose. [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

Primary references: [Apple required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [pinned MSAL telemetry configuration](https://github.com/AzureAD/microsoft-authentication-library-for-objc/blob/d54e9653f94883a896af533133888be1c2ef5c75/MSAL/src/public/configuration/global/MSALTelemetryConfig.h), [pinned Google request parameters](https://github.com/google/GoogleSignIn-iOS/blob/7823e518f5d4db765ccac3e140dd3265ef0a1cf1/GoogleSignIn/Sources/GIDSignInPreferences.m), [Google privacy policy](https://policies.google.com/privacy), [Microsoft privacy statement](https://www.microsoft.com/en-us/privacy/privacystatement), [Apple privacy policy](https://www.apple.com/legal/privacy/en-ww/).

Private evidence: `output/production-validation/ios-privacy-audit/`. No live interception, account-content export or server-side retention audit was performed. Store answers remain unsubmitted.
