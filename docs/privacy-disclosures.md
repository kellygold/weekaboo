# Privacy disclosure preparation

Reviewed 11 September 2026 against source `d824b4d` and the current App Store distribution export. This is the engineering evidence sheet for preparing store answers, not submitted labels. Website policy source is `website/privacy.html`. No Weekaboo service receives app data; calendar providers still receive authentication and synchronization traffic. Local task storage and provider calendar storage must be described separately.

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

## Android review follow-through

The current pinned libraries are `play-services-auth:22.0.0` and `msal:8.4.2`. Google's adapter calls AuthorizationClient with calendar, email and OpenID scopes; it does not request phone, SMS or location APIs. Presence of auth-api-phone/FIDO transitive packages alone is not evidence those capabilities execute. Microsoft explicitly sets PII and logcat logging false, broker registration false, and requests profile/calendar access (shared-calendar scope only for the relevant organizational mode). App source requests Internet and network-state permissions; the final merged artifact, rather than source manifest alone, remains the authoritative permission inventory.

Google's core Play-services disclosure page covers base/basement/tasks, not the authentication service; its no-end-user-collection statement cannot be generalized to authorization. Microsoft's logging documentation confirms PII/logcat controls, but does not establish absence of remote authentication diagnostics. These findings narrow the remaining SDK questions without guessing the final Play answers. [Google core SDK disclosure scope](https://developers.google.com/android/guides/play-data-disclosure), [Microsoft Android logging](https://learn.microsoft.com/en-us/entra/identity-platform/msal-logging-android).

Play's form has its own collection/sharing definitions and exceptions; do not copy the iOS label mechanically. Review the app's actual provider sync and SDK behavior using [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en). No store answers have been submitted.

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
- Complete the corresponding Android SDK review and Play Data safety draft independently.
- Present final policy, store answers and publication destinations together for Kelly's approval. No immediate new account registration or payment is required.

Apple includes third-party SDK practices in its disclosure requirements and distinguishes local-only processing from retained off-device data. Recurring calendar sync is core functionality; initial opt-in alone does not make all later data optional to disclose. [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

Primary references: [Apple required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [pinned MSAL telemetry configuration](https://github.com/AzureAD/microsoft-authentication-library-for-objc/blob/d54e9653f94883a896af533133888be1c2ef5c75/MSAL/src/public/configuration/global/MSALTelemetryConfig.h), [pinned Google request parameters](https://github.com/google/GoogleSignIn-iOS/blob/7823e518f5d4db765ccac3e140dd3265ef0a1cf1/GoogleSignIn/Sources/GIDSignInPreferences.m), [Google privacy policy](https://policies.google.com/privacy), [Microsoft privacy statement](https://www.microsoft.com/en-us/privacy/privacystatement), [Apple privacy policy](https://www.apple.com/legal/privacy/en-ww/).

Private evidence: `output/production-validation/ios-privacy-audit/`. No live interception, account-content export or server-side retention audit was performed. Store answers remain unsubmitted.
