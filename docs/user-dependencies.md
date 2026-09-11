# User dependencies and early setup

## Google migration and discovery fix — 12 September 2026

All five new Google clients are received. Active Web, iOS and Mac private configuration and canonical Android registration files now use `weekaboo-app` (project number `124770503970`). Owner-only private backups and receipts are under `output/google-project-migration/active-cutover/`. Browser backend restarted and health200 verified. Microsoft/iCloud configuration and signing keys are preserved.

**Test-user setup completed:** Kelly added the intended accounts and completed fresh Android, Mac, browser and iOS simulator Google consent on 12 September. New-project Android audience/identity/calendar discovery, Mac consent and Google UI create/edit/delete/readback/cleanup/restart, and browser callback/identity/discovery, actual refresh grant and UI CRUD/readback/cleanup now pass. Existing accounts and calendar settings were retained; Android’s three tasks are unchanged. iOS simulator has one active Google account, three calendars and 24 fetched events; restart preserved the account, calendar settings and events. All new clients are configured; no additional client registration is needed for this direct-release test. See [migration evidence](google-project-migration.md#fresh-consent-after-test-user-setup--12-september).

**Runtime candidate `d3bcf4b`:** shared manual discovery now continues after an account fails, preserves failed-account calendars/settings, and retains its warning until discovery recovers. Three regression cases cover partial/all failure and warning persistence. Full safe suite182/182, TypeScript, exact-commit engine22/22 pass. Scoped independent Claude review completed in180seconds with no blocking findings; this is not whole-release approval.

- Android: new signed APK/AAB verified; APK installed in place on the tablet. Exact three-task backup comparison, all account sections/calendar selections retained, release inspection disabled. `output/google-project-migration/android-discovery-fix/`.
- iOS: new signed App Store IPA exported and verified;18/18 fresh iPhone/Mini/standard-iPad simulator tests pass. Retained consent simulator updated in place without data loss: `F18043A2-D6F3-4A75-9BFA-7BF07FBF5330`. Fresh new-client simulator consent and discovery now pass; physical/store execution remains unproved. `output/google-project-migration/ios-discovery-fix/receipt.json`.
- Mac: signed app/DMG rebuilt, package/mount/resource checks pass. Current Microsoft/iCloud UI create/edit/delete, provider readback, cleanup, restart, task and calendar-setting retention pass. `output/google-project-migration/mac/unchanged-providers-1789164513260/receipt.json`. Google fresh consent and live CRUD also pass; Mac is not notarized.

No binary/store upload or site deployment occurred. Follow [Google migration](google-project-migration.md) for detailed evidence, prior failures and remaining consent work. Next: complete remaining platform-specific CRUD/expiry boundaries and distribution preparation. Keep direct-APK evidence separate from Play-installed signing acceptance.

## Current setup status — 11 September (supersedes historical blockers below)

**Done:** Play Console identity and Android package/release key registered; Android release Google/Microsoft/iCloud connected. Full Xcode installed and signed in. Physical iPad Mini trusted with Developer Mode and Web Inspector enabled; signed development build installed and all three accounts connected by Kelly. iOS provisioning now works through the existing Apple team. Google iOS plist and Microsoft Apple callback configured. Domain email forwarding for weekaboo.app configured by Kelly. Mac Google, Microsoft and iCloud initial sign-in is now user-confirmed, with active accounts and discovered calendars independently checked in read-only local metadata.

**Still needed for later distribution:** Mac registrations and initial provider connections are complete. Google OAuth consent branding currently says Instapie and must be deliberately addressed before public distribution. Public source repository is live at https://github.com/kellygold/weekaboo. Current Android and Mac signed candidates are built and checked; the current iOS archive now exports successfully with an App Store distribution profile through existing Apple signing. Binary download destinations, store records/testers/metadata/privacy disclosures and notarization remain separate gates. No new Apple certificate or OAuth registration request is needed now. Do not ask Kelly to repeat completed mobile registration or account setup.

**Device state:** Kelly disconnected the physical iPad Mini for factory reset/sale; device testing is closed and final file cleanup was explicitly waived. Do not reconnect or automate it. Android was reconnected by Kelly later on 11 September; the current release is installed, exact original tasks are retained, and offline restart/recovery plus disabled WebView inspection are verified. Use in-place updates only. Continue on the isolated Android emulator, all three iOS simulator form factors and Mac. No publication, store submission or charges are implicit.


Updated 11 September 2026. Companion to the [canonical plan](cross-platform-plan.md). Purpose: complete user-dependent setup early so implementation can proceed autonomously. This is a repository checklist, not a request to create external trackers or spend money. Mark evidence and completion here as work proceeds; do not store credentials.

## Delivery order and artifact decisions

1. **Android first:** standalone Capacitor application, signed APK for direct testing/distribution and AAB suitable for Google Play submission. The primary tablet must function without the Mac.
2. **iOS second:** standalone Capacitor application with the same UI/core/provider engine, appropriate signing and provisioning, TestFlight/App Store submission capability.
3. **macOS third:** package the shared application in a selected desktop runtime as a signed/notarized app and DMG. Do not delay Android or iOS for a desktop framework decision.
4. **Browser:** retain the functioning computer UI throughout. Production web remains a target, not merely a throwaway demo; full standalone browser provider coverage is unresolved and may be deferred while mobile delivery proceeds. Do not mark it production-ready based only on the current Mac-backed version.

Mobile targets are native application packages, not only add-to-home-screen PWAs. A PWA may supplement the browser experience later; it cannot substitute for native provider authorization/transport. App-submittable means technically prepared and validated for submission; approval by Apple/Google is not guaranteed.

All targets should converge on the same supported product behavior and quality. Their delivery dates and native facilities can differ. Keep a parity matrix for account onboarding, calendar CRUD, recurrence semantics, notes, attendees/meeting links, tasks, offline persistence, reconnect and interaction accessibility. Explicitly identify unavailable capabilities rather than falsely passing them. User has allowed sequencing, not permanent abandonment of iOS/web or a separate UI implementation.

## Already established locally

- Kelly reports an existing Apple developer account used for Paper In's DMG.
- Read-only local identity inspection found **one valid Developer ID Application identity**. It did not list Apple Development or Apple Distribution identities. Names, fingerprints and private keys were not exported.
- Paper In's `docs/distribution.md` and `scripts/package-dmg.sh` describe Developer ID signing, hardened runtime, timestamping, app and DMG notarization/stapling, receipts and Gatekeeper validation. Reuse the method, not the scanner app's identifiers, entitlements or build assumptions.
- The documented notarization Keychain profile is `paper-in`. This is a profile name, not a secret. Its existence/current validity and current Apple membership status were not checked by authenticating to Apple.
- `xcode-select -p` returned `/Library/Developer/CommandLineTools`. No Xcode app was found in the ordinary `/Applications` listing checked during this task. That is not proof Xcode is absent from every possible location. Full Xcode/iOS SDK availability must be checked before iOS builds.
- `adb devices` reported zero attached authorized Android devices. An asynchronous question about USB testing was sent; reply not yet recorded.
- Domain purchase status was asked asynchronously; reply not yet recorded. A plan to purchase is not proof of ownership.

## Early checklist

| ID / timing | What is needed | Agent can do autonomously | Kelly may need to do | Completion evidence / fallback |
|---|---|---|---|---|
| U1 — before first native Android test | Tablet access and debugging | Prepare build, check SDK/ADB, give precise install steps | Connect USB, enable Developer options/USB debugging, accept the computer trust prompt | `adb` authorized device plus installed app launch; fallback is Kelly manually installing a signed test APK |
| U2 — before native provider console entries | Stable app identities and signing fingerprint | Propose/check availability of `app.weekaboo.calendar`, create dedicated development/release signing setup when implementing, keep private material in protected storage, derive public fingerprints | Only respond if brand/domain ownership or existing identifiers conflict; handle account reauthentication when necessary | Recorded package/bundle IDs and matching console entries; provisional name is not registered yet |
| U3 — before Android Google/MS connection | Native OAuth registrations | Prepare exact client types, package/signature values, redirect/audience/scopes; configure through available authorized sessions | Complete Google/Microsoft login, MFA or inaccessible-console steps when prompted | Actual successful native consent, restart and token reacquisition; do not break existing web clients |
| U4 — first live provider tests | Account consent on the actual device | Build onboarding and safe fixture tests; independently exercise mock failures | Authorize selected test accounts and enter iCloud app-specific password through secure UI; Kerryn authorizes her own accounts | One of each provider tested without using real meetings; no passwords pasted into docs/chat |
| U5 — prepare during Android work, required before iOS | Full Xcode and Apple team access | Locate installations/toolchains, prepare Xcode project and config, use per-process DEVELOPER_DIR where possible instead of disturbing other projects | Complete App Store/developer login, MFA, license/system prompts if tooling cannot; confirm team only if multiple or ambiguous | Xcode/iOS SDK available and team recognized; existing CLT alone is insufficient |
| U6 — before iOS device/distribution build | Weekaboo App ID, profiles and appropriate certificates | Use existing authorized team, configure automatic signing, generate needed profiles/certificates through supported tools when authorized by build work; preserve existing identities | Handle Apple role restrictions, new agreements or login prompts if encountered | Device-signed app and distribution archive; Developer ID Application alone does not satisfy iOS signing |
| U7 — before iOS acceptance | Real iPhone access | Simulator tests, TestFlight-ready configuration, installation instructions | Attach/trust/unlock an iPhone and enable required development mode for local testing, or accept TestFlight invitation when available | Actual consent return, lifecycle, offline launch and edits verified; simulator is not enough |
| U8 — before public site/production OAuth | Domain and repository destination | Inspect existing GitHub access, prepare static site, exact DNS and consent metadata, sanitized source/release candidate | Purchase domain if absent; log into registrar or resolve owner choice when not inferable | Domain ownership, verified HTTPS, correct source/download links; GitHub Pages default address can serve project preview meanwhile |
| U9 — before Play publication | Play account/distribution route | Check existing account access, prepare AAB/listing/testing requirements and privacy declarations | Complete identity verification/agreements or approve a concrete fee if no account exists | Store-ready artifact and required account steps; direct APK tests continue independently |
| U10 — before public release | Maintainer/legal identity, privacy and asset rights | Infer from authorized existing registrations, prepare policies, license/asset inventory and exact missing items | Supply only unavailable rights/account-plan information or resolve ownership ambiguity | MIT/third-party notices, verified redistribution rights and accurate policies; remove/replace unsupported optional assets without a paid dependency |
| U11 — before macOS public DMG | Current signing/notarization access | Reuse valid team Developer ID identity if appropriate; validate the existing notary profile without exposing credentials; prepare Weekaboo-specific build/sign/verify pipeline | Unlock Keychain or complete Apple authentication/agreements only if needed | Accepted/stapled app and DMG; fresh-install/update validation; no certificate revocation as a setup shortcut |

Routine implementation choices are agent-owned: service interfaces, package boundaries, provider port order, tests, local fixtures, dependency evaluation, scripts and documentation. Do not make Kelly choose between technical libraries unless a material product/cost constraint requires it.

## Cost and signing clarification

An existing active Apple Developer Program membership can cover additional apps under the same eligible team; a separate membership purchase per Weekaboo app is not the default. Existing membership renewal remains a cost outside Weekaboo's server operation and has not been newly authorized.

A valid Developer ID Application certificate can be reused for another Mac application under that team; each app still gets its own identifier, entitlements and notarization submissions. iOS uses Apple Development/Apple Distribution identities and app-specific provisioning. Certificates may be shared at team level where appropriate; Paper In's app identity/profile cannot simply be renamed or reused wholesale. An app-specific password/notary profile used for notarization is not an iOS signing certificate or provisioning profile.

Sources: [Apple certificate purposes](https://developer.apple.com/help/account/certificates/certificates-overview/), [App ID registration](https://developer.apple.com/help/account/identifiers/register-an-app-id/). Membership/tooling facts are recorded above with their evidence limits.

## Working rule for dependencies

Ask for the earliest concrete user action that removes a real blocker; bundle related console/device steps into a short session. Provide the exact values/screens once known, never guesses that force rework. Allow unanswered optional preferences to retain documented defaults; do not treat silence as permission for purchases, public releases, credential exports or destructive actions.

Keep coding and testing independent portions while waiting for a login, physical device or approval. Before declaring a platform blocked, state exactly which user action remains and which work can continue. Update this checklist and the parity status when resolved, so the next session does not ask the same question again.

## 11 September implementation update

See [standalone progress](standalone-progress.md#native-test-registration-values) for exact debug Google SHA-1 and Microsoft signature values. Package `app.weekaboo.calendar` is now used in the local Android project; it has not been registered publicly or approved by a store. U2 development fingerprint preparation is complete; release signing remains open.

JDK 21, Android SDK 36 and a disposable API 36 emulator are installed. Debug APK and unsigned release AAB build. Emulator task/vault/offline/HTTP checks pass; this does not satisfy U1/U3/U4 physical-device consent. Async questions about USB access, domain ownership and native console entries were sent; no answers recorded yet. Google AuthorizationClient/MSAL bridges and read-preview implementations now build; negative/cancel checks pass on emulator. Live consent needs the native registrations. Google/Microsoft buttons are available when local prerequisites are present; setup details are shown in the accounts drawer. iCloud native read flow is now implemented with synthetic provider/native-vault proof; real password entry/consent is still needed. Shared native writes now pass synthetic installed Android tests across all three providers, including new iCloud repeats and individual occurrence edits; live consent and provider writes still need device validation.

No change to Xcode or Apple signing findings. No new fees, infrastructure, registrations or releases purchased/published.

11 September continuation: full Xcode is still absent (`xcode-select -p` → CommandLineTools; no Xcode in Applications). Kelly has been asked asynchronously to install and launch it once. No response recorded; keep Android work moving.

### 11 September continuation: precise Apple toolchain blocker

Full Xcode is still needed. The existing CLT installation is internally mismatched: `swift test` fails loading llbuild, and Swift 6.1.2 cannot consume the default SDK's Swift 6.2 interfaces. Selecting the installed 15.5 SDK per process also fails on duplicate SwiftBridging module maps. We did not repair or alter global developer tools. Install/launch full Xcode, complete its initial prompts, then run `npm run ios:simulator` (uses Xcode.app per process). iOS bundle `app.weekaboo.calendar` is scaffolded; Google iOS client and Microsoft `msauth.app.weekaboo.calendar://auth` registration can be prepared, but Apple SDK authorization code is still pending, not merely credentials. Developer ID does not establish iOS provisioning.

## Task transfer now available (11 September)

Settings → Export tasks on the original browser, transfer the JSON however you prefer, then Settings → Import tasks in the native app. Preview adds only missing tasks; existing device versions remain unchanged and conflicts are counted. Calendar accounts must still be connected separately on each device. No task/account/password data was transferred on Kelly's behalf during implementation; only disposable emulator fixtures were used. Android save/open/cancel and repeat import proved; iOS picker source awaits full Xcode validation.

## Registration files and Apple source update (11 September)

Run `npm run native:setup` for a read-only current readiness report. It derives the actual local Android debug SHA-1/signature, checks public client configuration and full Xcode, and counts authorized physical Android devices. It never prints credentials or claims console registration/consent from local settings alone.

Prepared **`ios/native-auth.xcconfig`** (ignored, mode 0600): Google placeholders and the existing public Microsoft application client ID. Do not put a secret in this file. Copyable tracked template: `ios/native-auth.xcconfig.example`.

Kelly's early actions:
1. Google Cloud: add an **iOS OAuth client** for `app.weekaboo.calendar`; put its client ID and reversed client ID in the two Google fields. Keep the existing Android and web entries.
2. Entra: add the **iOS/macOS platform** for this same bundle on the existing app; redirect `msauth.app.weekaboo.calendar://auth`. Support personal Microsoft and organizational accounts; existing delegated permissions remain. No native client secret.
3. Install and launch full Xcode, complete its initial setup, and make the Apple developer team available. Current MSAL 2.15.0 requires **iOS 17+**, and GoogleSignIn 10.0.0's package requires Swift 6-capable Xcode. The CLI Swift installation is still incompatible even for the attempted frontend parse; no global toolchain was modified.
4. Connect/trust the Android tablet first; later an iPhone for actual consent and lifecycle checks. No physical Android device is authorized in the latest report.

Google/MS iOS SDK adapters are now written and awaiting compile/review/device proof. This supersedes the earlier “authorization code not implemented” status, but does not establish a usable iOS build. Google iOS uses per-account secure archives to preserve multiple connections; validate two accounts across process restart. Rejected unexpired Google tokens currently require reconnect, unlike Android's forced-renewal path. Public distribution and signing remain separate gates; no fee, deployment or release is authorized by filling these files.

## Immediate setup for the implemented native apps (11 September continuation)

These steps can happen while implementation continues. **Do not paste personal tokens/passwords in chat or these docs.** Native devices reconnect individually; account/password entry happens in their UI, not by copying browser database credentials.

1. **Android Google:** Google Cloud → OAuth clients → Android. Package `app.weekaboo.calendar`, development SHA-1 `7E:0B:37:27:7E:B4:62:2E:1C:58:B0:E5:A0:F4:93:F1:F7:14:AF:F6`. Keep the Calendar API enabled and add testing accounts where required. Public release uses a different signing fingerprint. No Android secret or new paid API is required.
2. **Microsoft:** retain the existing app and personal+organization audience; add platforms without deleting its working Web setup. Android package above with signature `fgs3J360Yi4cWLDloPST8fcUr/Y=`; iOS bundle `app.weekaboo.calendar` with `msauth.app.weekaboo.calendar://auth`; **Mobile and desktop applications** with `http://localhost` for the Mac system-browser callback. Desktop listener uses a random local port. Shared-calendar delegated permission is opt-in at runtime, with ordinary Calendars.ReadWrite/User.Read available. Actual consent proves the console configuration; local client IDs alone do not.
3. **iOS Google:** create an iOS client for `app.weekaboo.calendar`. Put its client ID and reversed-client-ID URL scheme in ignored `ios/native-auth.xcconfig` (placeholders prepared). Existing Microsoft public client ID is already there. Install and launch full Xcode, finish first-launch components and sign into the existing developer team. iOS target is currently 17+. Developer ID for Paper In does not replace iOS provisioning.
4. **Mac Google:** create a separate **Desktop app** OAuth client. Put its `client_id` in `desktop/native-auth.json` → `google.clientId`. Its installed-client JSON may also supply `client_secret`; put that in `google.clientSecret`, or an empty string if omitted. This is a public installed-client registration parameter, not the existing web secret; anything in this native config is bundled in the Mac app. Existing Microsoft public client ID is already populated. The tracked `desktop/native-auth.example.json` shows the shape. Rebuild after changing registrations.
5. **Physical testing:** connect the Android tablet by USB, enable USB debugging and approve this Mac. Later trust an iPhone in Xcode for on-device testing. Sign into each provider on each installation; enter an Apple app-specific password in Weekaboo's account setup. No credential copying by the agent is needed. Tasks can be transferred explicitly through the existing JSON export/import controls.

Agent can continue native engine, fixtures, packaging and source cleanup without these. Successful native consent, real-provider regression writes, iOS compilation/provisioning, physical gestures and public signed distribution cannot be honestly claimed until the relevant steps are complete. No store submission, infrastructure, paid service or public release is authorized by filling these files.

### Existing Mac signing access proved locally

The existing Developer ID identity successfully signed a Weekaboo arm64 app with hardened runtime; strict signature verification and isolated packaged launch/task-save passed. A signed DMG was also built and verified. No new identity, Keychain-wide change, Apple submission or public release occurred. This resolves local certificate-use uncertainty for U11, but notarization/stapling, Gatekeeper/install/update acceptance and public redistribution remain open. It does not resolve iOS provisioning or full Xcode. Evidence: `output/standalone-desktop/package-signed.json`, `packaged-signed-proof.json`, `dmg-signed.json`.

### Registration completion — 11 September

Imported newest downloaded Google iOS plist into ignored, owner-only `data/oauth/google-ios.plist`; verified bundle ID and reversed client ID, updated ignored `ios/native-auth.xcconfig`, preserved private prior config, removed byte-verified Downloads original. Setup checker confirms both iOS client configurations present. No client values or secrets recorded here. User supplied matching Microsoft Apple platform configuration with common audience and `msauth.app.weekaboo.calendar://auth`. Actual iOS consent still unproved. User reports iCloud connected on Android. Keep Android attached through remaining physical tests before iPad swap.

Kelly has no existing Play Console account and is considering personal-account registration. Wants main Gmail private. Explained account login/private Google contact can remain existing account while developer-profile and app-support addresses use a separate maintained inbox. No account creation, payment, email changes or store upload performed by agent. Public personal profile still includes legal name/country under Google's requirements.

### Play Console enrollment submitted — 11 September

Kelly completed developer-account signup and the currently available verification steps. Identity review is pending; Kelly expects one or two days, not a guaranteed provider completion time. Do not ask for signup again or treat account verification as approved. Local APK/device testing continues. Project-domain email forwarding is configured; login resolved. No DNS or mail changes made by the agent.

### Play Console identity verified — 11 September

Kelly confirms verification is complete, superseding the pending-review entry above. Supplied screenshot is the Android developer-verification package registration page; it does not establish package registration or release approval. Local Android release signing remains unconfigured; current tablet APK uses the debug certificate. Next prepare dedicated release signing and OAuth fingerprints, then store candidate and test-track setup. No upload or publication performed. For Play apps, follow the Play app setup/automatic registration flow; separately distributed APK signing keys need registration as applicable. Reference: https://developer.android.com/developer-verification/guides/google-play-console .

### Android dedicated release key prepared — 11 September

Created dedicated RSA-4096 PKCS12 release identity (alias weekaboo-release) in owner-only `~/.config/weekaboo/signing/`. Keystore and generated password are separate mode-0600 files, outside repository; no secret values logged. Public certificate export and JSON fingerprints live beside them. Public copyable SHA-256: `output/production-validation/android-release-public.txt`. User was supplied the release certificate SHA-256 for package registration. Registration success, off-machine secure backup and Play App Signing enrollment remain unproved. Do not regenerate/overwrite this identity. Never use the upload-key certificate as the installed-app OAuth signing identity. Google/MS release fingerprints still need console configuration; no release APK installed over the existing debug app and no user data removed. If Play requests an ownership snippet, prepare exact snippet in a separately signed proof build after receiving it.

### Android package/key registration confirmed — 11 September

Kelly reports the new package/key registration says Registered, using `app.weekaboo.calendar` and the dedicated release certificate supplied above. Treat registration as user-confirmed complete; no ownership-proof APK requested. Play listing, signing integration, OAuth release fingerprints, test tracks and public submission remain separate. Do not ask Kelly to repeat registration.

### Release OAuth registrations completed — 11 September

Kelly proceeded with the separate release entries after discussing the optional development/release distinction. Preserve both now-existing entries; do not silently switch all builds to a single key or remove registrations. Google screenshot confirms Android Release OAuth client created; newest JSON imported byte-for-byte into ignored owner-only `data/oauth/google-android-release.json`, then original removed from Downloads. It contains no client secret or package/certificate fields; local JSON alone cannot prove SHA-1 console setting. Microsoft screenshot shows both development and release Android signature rows under the existing app; user reports release hash added. No separate Microsoft JSON found or needed. Release callback has the same package but a different signature suffix, not an identical URI. Actual release-signature consent remains to validate.

### iPad / public Google branding — 11 September, latest

Physical iPad Mini 6 is trusted, Developer Mode enabled, automatic team signing/provisioning succeeded and the debug app was installed/launched. Kelly is connecting accounts. No need to repeat Xcode/signing/Developer Mode setup. Physical live provider validation still pending.

Kelly sees **“Sign in to Instapie”** in Google consent on iOS. Likely the Weekaboo clients are in the older Instapie Google Cloud project, whose consent branding applies to every OAuth client. Confirm project membership before changes. **Release blocker: Weekaboo-specific Google consent branding/project**, with matching Android debug/release/Play signing identities, iOS bundle/client and desktop client, calendar scopes, test-user/publishing/verification state and owned public URLs. Do not rename the existing project's consent app blindly: it may still serve Instapie. Kelly explicitly deferred fixing this until later; preserve current working test credentials for now. No provider-console change made.

### Microsoft desktop localhost registration complete — 11 September, 20:25 AEST

Kelly explicitly confirmed the localhost update. Mac uses `http://localhost` under the same Microsoft app's Mobile and desktop platform; Android signature callbacks and Apple custom scheme remain unchanged. Latest signed Mac app is rebuilt/reopened with cancel/retry recovery. Next user action: retry Microsoft in the app and report the result; no further registration request. Google final retry and Mac iCloud connection still need confirmation. No token or private credential access needed by the agent.

### Mac initial connection complete — 11 September, 20:29 AEST

Kelly reports Google, Microsoft and iCloud connected successfully. Read-only metadata independently confirms all active, no attention flag, 3/1/4 calendars respectively. No credential/event reads or app interruption. Do not ask for initial Mac consent or localhost registration again. Remaining Mac restart/refresh/provider-mutation checks are engineering validation, not another registration task. See `current-validation.md` and `output/production-validation/mac-connected-providers.json`.
