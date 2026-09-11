# Current validation and release gaps

Updated 11 September 2026, 21:00 AEST. This is the current engineering summary; historical attempts remain in `production-validation.md` and `standalone-progress.md`. **Public source creation at `kellygold/weekaboo` is authorized once clean. No binary release, store upload or website deployment approval.**

## Physical iPad released to Kelly

**Device automation stopped on 11 September at approximately 19:50 AEST. Kelly explicitly waived remaining cleanup because the iPad is being factory-reset and sold.** Xcode cleanup process and Web Inspector bridge stopped; device process inventory confirmed no Weekaboo UI test runner remained. No more physical iPad work. Continue with simulators or Kerryn's future device. Lock/unlock and runtime inspection-disabled checks remain unvalidated.

All synthetic calendar events and tasks were removed. Two of the three synthetic local backup files were removed; final file cleanup was intentionally interrupted at Kelly's request. Factory reset will remove any remainder. This is a waived cleanup step, not a passing cleanup test.

## Current evidence

| Surface | Proved | Limits / next gate |
| --- | --- | --- |
| Shared React / TypeScript | 180 current tests pass: layouts, scale, gestures, tasks/history/import, rich notes, meeting links/attendees, provider engine, conditional writes, storage/auth errors | Synthetic tests do not prove every live provider or device behavior |
| Android physical | Prior signed release installed, all three accounts connected; live single-event CRUD and original-task restoration recorded | Tablet unplugged. Latest loading/icon/version build not installed there |
| Android release emulator | Signed release cold launch, task restart persistence, replacement by signed AAB-derived APK retaining task, completion/Done/delete, Settings; fixture removed | Disposable `userdebug` API 36 image. No live consent in this pass; inspection-disabled runtime check unavailable on debug OS |
| iPad Mini physical, Debug | All three user-connected providers pass create/edit/delete through UI, direct readback and cleanup. Portrait/landscape views/settings, mascot real audio/randomization/tap highlight, synthetic native Keychain round trip, cached-event retention under injected native HTTP failure | iPadOS 26.6.2 only. Earlier inspector/editor test failures are preserved; clean final all-provider run supersedes them for basic CRUD |
| iPad Mini physical, Release | **Six tests pass:** all three accounts retained; task create/restart/complete/Done/delete; actual Wi-Fi off + full restart retains identical cached event labels, Wi-Fi restored and refresh completes; native SQLite reopen/CAS; isolated Keychain rejected-write preservation/ThisDeviceOnly/no synchronization/cleanup; invalid HTTP requests rejected before networking | Development signed, not store-exported. No new provider mutations in this Release pass. Full expiry/revocation/lock/recurrence matrix remains open |
| iPad native file transfer | Synthetic task exported to On My iPad, removed locally, file selected/imported through native picker, one task added, restored task deleted. Picker cancellation also passes | Full file-flow test halted only at cleanup in Apple's Files UI. Remaining file cleanup was waived by Kelly for factory reset; the cleanup test did not pass. Earlier preview selector issue corrected (`1` and `tasks to add` are separate AX nodes) |
| iPhone / iPad simulators | iPhone 17 Pro, Mini A17 Pro, standard iPad A16: 3 native core + 3 UI each = 18 passing tests | Runtime 26.5. Fresh standard iPad pass after notice packaging: six tests. No physical iPhone/larger iPad or minimum-OS acceptance |
| Mac Apple Silicon | Native SQLite/CAS, actual safeStorage, sandbox/IPC/HTTP/file bridge, signed app/DMG. Copy from DMG, launch, views, task export, bundle replacement/restart persistence, completion/delete/import restoring ID | File chooser paths automated. Kelly confirms all three Mac provider sign-ins succeeded; read-only metadata confirms Google (3 calendars), Microsoft (1), iCloud (4), all active with no attention flag. All three providers now pass actual UI create/edit/delete plus direct readback and cleanup; accounts survive full restart. Injected provider outage retains 19 cached event labels after renderer reload and recovers with silent acquisition; tasks/settings preserved. True token expiry/revocation remains untested. No notarization/download Gatekeeper or Intel acceptance |
| Static website | Free/open-source privacy-first copy, flexible tasks, context groups, bidirectional sync, proper attributed icons; 8 Chromium/WebKit viewport checks including 320px, local assets/audio, no external requests | Local preview only at http://127.0.0.1:5190. Source/download URLs not set; no publication |

## Evidence locations (ignored/private)

- Shared: `output/production-validation/current-shared-tests.log`.
- Android: `android-release-emulator.json`, `android-current-candidate.json`, `android-bundletool-proof.json` under `output/production-validation/`. Official bundletool 1.18.3 validated AAB and generated signed universal APK; emulator installed that APK with `-r`.
- iOS simulators: original 18-test matrix `output/production-validation/ios-20260911T090230Z/matrix.json`; latest standard iPad six-test pass `ios-20260911T095640Z/matrix.json` and `ipad.xcresult`.
- iPad: `output/production-validation/ipad-physical/`. Basic live proof `live/all-current-pass.json`; `lifecycle.xcresult`, `parity.json`, `files.xcresult`; final Release **`release-device-pass.xcresult`**, `release-device-tests.json`, `installed-release-configuration.json`.
- File-flow receipts: `final-physical-retry.xcresult`, `physical-files-offline.xcresult` retain successful transfer steps and later system-UI cleanup failures. `backup-cleanup.xcresult` was intentionally interrupted at Kelly’s request. Cleanup was waived for factory reset; do not resume device work.
- Mac: `output/standalone-desktop/{foundation,packaged-signed-proof,dmg-mounted-proof,install-lifecycle}.json`.
- Website: `output/site-validation/results.json` and screenshots.

- Latest package notices and hashes: `output/production-validation/bundled-notices-proof.json`; current IPA signature/provisioning: `ios-development-export-proof.json`; current archive: `ios-release-archive.json`. Repeat with `node scripts/verify-bundled-notices.mjs`, `python3 scripts/verify-release-artifacts.py`, and `python3 scripts/verify-android-bundle.py`. The latter validates the pinned official bundletool digest and produces a signed universal APK without reading password values, installing or uploading.
- Latest Android emulator receipt proves the refreshed AAB-derived APK retained tasks across replacement, then completed/deleted the fixture. Mac packaged smoke and read-only DMG mounting passed on the refreshed artifact. Previous fuller Mac install-lifecycle proof predates this notice-only change.

Raw device screenshots/account labels are private. Sanitize before sharing. No credentials were exported into task backups or copied between devices.

## Artifact boundaries

Canonical metadata is `package.json`: **0.1.0 / build 1**. Android reads it directly; `scripts/release-version.mjs` drives desktop and tracked `ios/Version.xcconfig`. `npm run version:sync` updates iOS metadata; build numbers never auto-increment.

- APK/AAB: `android/app/build/outputs/apk/release/app-release.apk`, `bundle/release/app-release.aab`; signatures verified, debuggable/backup off, logging off, no server URL/private data. Physical Android has an older candidate.
- iOS archive: `output/production-validation/ios-source-cleanup-current/Weekaboo.xcarchive`. Development export: `ios-source-cleanup-current/development-export/App.ipa`; signature/configuration verified, provisioned for one registered device. **Not TestFlight/App Store or general family distribution.**
- Final physical Release test app: `output/ios-physical-release-tests/Build/Products/Release-iphoneos/App.app`; checked signature, metadata, empty Capacitor debug flag, logging none, no remote server URL or inspection override.
- Mac: signed hardened-runtime Apple Silicon app and `Weekaboo-0.1.0-arm64-signed-preview.dmg`. Not notarized.
- **Notice packaging is now rebuilt and verified in the signed APK/AAB, iOS archive/development IPA and signed Mac app/DMG.** Shared collector: 44 browser packages, 47 Android/iOS renderer packages, 46 Mac renderer packages; 34 Mac main-process packages plus Electron/Chromium notices. Upstream texts are byte-identical. Missing texts fail builds. Physical installations predate this notice-only change. Native-mobile SDK/project/generated-asset rights remain separate gates.

## Android inspection boundary

The emulator runs `userdebug` / `ro.debuggable=1`. Chromium forces WebView inspection on debug Android OS images and ignores disable requests. The installed release app is non-debuggable. The harness records inspection-disabled as **unvalidated**, not passed, on this OS; it requires no app socket on a normal `user` OS. Verify the exact release on the physical tablet later. No app configuration was weakened to accommodate this check.

Sources: [Chromium network debugging](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/docs/net-debugging.md), [SharedStatics implementation](https://github.com/chromium/chromium/blob/main/android_webview/glue/java/src/com/android/webview/chromium/SharedStatics.java).

## Latest Mac Google sign-in correction

Google callback returned, but token exchange failed because the desktop fetch adapter serialized URLSearchParams without its form content type. Fixed without changing registrations or user data. The real Google token endpoint now parses a synthetic invalid-credential request and returns normal `invalid_client`; Kelly subsequently confirmed successful Google sign-in (see Mac connection confirmation below). All 11 desktop tests pass, including a new regression at the real SDK → fetch adapter → bounded HTTPS boundary. Signed app/DMG rebuilt and packaged smoke checks pass; corrected app reopened for Kelly. Independent scoped Claude review completed with no blocking findings in 124 seconds; this is a diff review, not whole-app release approval. Review snapshot omitted installed dependency source, separately exercised by local tests. Evidence: `mac-google-form-*.log`, `mac-google-form-live-negative.json` under `output/production-validation`.

## Latest connection cancellation validation — 11 September, 20:25 AEST

Kelly explicitly confirmed the Microsoft desktop `http://localhost` registration update. Keep existing Android/iOS callbacks; no further client creation required. Signed Mac app and DMG rebuilt and verified, normal Weekaboo app reopened for Kelly's Microsoft retry. Superseded by Kelly’s successful all-provider Mac connection confirmation below.

Desktop Google/Microsoft sign-in now offers Cancel sign-in, closes the loopback listener, clears progress and permits retry. Five-minute expiry is reported as a timeout rather than user cancellation. All providers show delayed help while checking access; received failures clear progress and unlock navigation. An error remaining solely on an external provider page cannot be observed by Weekaboo until callback, cancellation or timeout. Mobile keeps native SDK cancellation; iCloud has bounded network requests and no new cancel action.

Shared coordinator prevents cancelled preparation from publishing account metadata and rolls back new grants. Cancellation bypasses the auth queue, preserves silent refreshes, invalidates already-queued interactive operations and checks again after the asynchronous account-store read. Once metadata commit begins, cancellation cannot undo that commit.

Evidence in `output/production-validation/`:
- `connection-cancel-full-tests-final.log`: **180 passed**. Focused delta suite: **40 passed**, TypeScript passed. Initial run had three navigation/interaction failures (174/177); affected files reran 26/26, then final full run passed. Concurrent development reload is suspected, not established. A second intermediate full run was intentionally interrupted for the confirmed review fix.
- `desktop-cancellation.json`, `desktop-signin-cancel*.png`: packaged UI → real IPC → actual loopback cancel for Google, Microsoft, then fresh Google; listener closed, zero connected accounts, isolated profile removed. External browser opening alone stubbed; no real consent asserted. Packaged task save/provider availability and read-only DMG signature/archive/private-path checks pass.
- `android-release-emulator.json`: latest signed APK/AAB-derived replacement retains task through restart/upgrade; completion/history/delete/settings pass; fixture cleaned. Debug OS still prevents proving inspection disabled on a normal device.
- `ios-20260911T102154Z/matrix.json`: standard iPad simulator **six passed**, runtime 26.5, simulator shut down. No sold iPad or other physical device touched.
- `connection-cancel-review-reproduction.log`: all three new race regressions fail against the pre-fix snapshot in a disposable isolated source copy, and pass on current code; temporary copy removed.
- `connection-cancel-review-status.json`: independent Claude review found one queued-cancellation blocker at snapshot `8e5b8ecee9b44ca606a80300e8e45c9fc866221d`; author fixed it with actual-adapter/coordinator regression coverage. `connection-cancel-delta-review-status.json`: follow-up at `bac32387810efe8f48551ed3256193ef1a38bdf7` timed out within the original eight-minute wall-clock budget. **Independent follow-up incomplete; no release approval.** No more review retries in this work session.

Artifact boundary: browser bundle, mobile renderer, signed Android APK/AAB and signed Mac app/DMG include this change. iOS connection-feedback archive/IPA were subsequently rebuilt at `ios-connection-current/`; see the newer checkpoint below. The latest native acknowledgments have been proved in a separate simulator build and still require signed archive/IPA refresh. Earlier physical/mobile consent evidence remains historical. No uploads, notarization, credential copying or user-profile resets.

## Mac connection confirmation — 11 September, 20:29 AEST

Kelly reports all three providers connected successfully in the Mac app. A separate read-only query of the normal app's local calendar metadata confirms Google: three calendars; Microsoft: one; iCloud: four. Every account is active with no attention flag. Receipt: `output/production-validation/mac-connected-providers.json`. Only aggregate provider/status/calendar counts were returned; no credential store or event bodies accessed, no data changed, and the running app was not interrupted.

This historical checkpoint closed initial Mac consent and calendar discovery. The subsequent Mac live/recovery checkpoint below closes basic live edits and restart retention, but not recurring-event or true token-expiry behavior. No new account registration or re-consent requested. Independent cancellation delta review remains incomplete as recorded above; distribution gates remain open.

## Mac live and recovery checkpoint — 11 September, 20:47 AEST

Signed candidate ASAR SHA-256: `567bc18eb791929ff300eb9ebbbaea25d6d16fbef521d828ec4e4ca1b2cbf128`.

- `output/production-validation/mac-live-1789122830734/receipt.json`: Google, Microsoft and iCloud each passed UI create, notes/location edit, direct provider readback, UI delete and absence readback. Exactly identified attendee-free fixtures only; all removed. Original tasks and calendar/account settings hashes unchanged; all three accounts survived initial and final full process restarts. Refresh animation proved. Normal app reopened after instrumentation.
- `output/production-validation/mac-recovery/receipt.json`: simulated failures at native request/auth-acquisition IPC retained 19 existing visible event labels through renderer reload and failed refresh; restored transport recovered all three active accounts without interactive consent. Original task hash unchanged. All writes were blocked during this test. This was an injected provider outage, **not physical network-off testing or a full process restart while offline**. Silent acquisitions do not prove expired-token renewal.
- `output/production-validation/ios-connection-current/receipt.json`: refreshed development archive and IPA include current connection feedback, all 85 renderer files and 47 bundled JS package notices. Strict signatures/profile/configuration pass. Profile still permits only the former physical iPad; not general distribution.
- `output/production-validation/native-ios-notices/receipt.json`: new collector passes five tests and packages 13 original notices from ten locked Swift dependencies (including pinned MSAL IdentityCore submodule) in a fresh simulator app. All 15 resources match exactly. Signed archive/IPA were subsequently refreshed at `ios-source-cleanup-current/`, verified below. Native binary/transitive rights are not certified by this check.
- `output/production-validation/native-notice-audit/receipt.json`: Android resolved 93 runtime coordinates. The prior signed APK does not preserve complete native notices. A new collector now preserves 30 original files from 92 resolved components, including Google Auth third-party files, verified byte-for-byte in a debug APK; five tests pass. Its manifest still lists 78 unresolved components; release/bundle scripts fail until that inventory is resolved. Full Android acknowledgments remain open. See `native-android-notices/receipt.json`.
- `output/site-validation/free-open-source/receipt.json`: prominent free/open-source copy, privacy explanation and eight browser/layout checks pass; local preview only. User has now authorized creating public `kellygold/weekaboo` once the source is clean. Source preparation is tracked separately in `release-checklist.md`.

Unused raster concepts, motion study and five rejected greetings have since moved to ignored `output/asset-review-archive/`. Approved runtime greetings are unchanged. This source asset cleanup is newer than the tested signed artifacts; the iOS archive/IPA refresh is now complete; Android and Mac signed assets still need a final refresh before distribution. Existing live functional evidence remains tied to the hash above.

## Remaining release work

1. Physical iPad testing is closed. Preserve the Mac-side evidence and continue remaining iOS cases in simulators; do not reconnect or control the sold device.
2. Exact-current Android physical upgrade/recheck when available; no uninstall or signing-key replacement.
3. Mac initial connection, basic live CRUD/readback/cleanup, full restart/account retention and injected provider outage/recovery pass. Continue remaining expiry/revocation/recurrence matrix with bounded fixtures. Never copy another platform’s tokens or use browser client secrets.
4. Deliberate Google consent branding/project migration from Instapie without breaking that project.
5. iOS distribution/export/TestFlight; Mac notarization/download acceptance; Play App Signing/track/testers/store disclosures. Local success is not approval to upload.
6. Remaining expiry/revocation/cancellation/lock/upgrade/recurrence and minimum-supported-OS matrix. Preserve honest provider limitations.
7. Complete notices across native SDKs; final project license/owner and generated asset rights; public source/download URLs and release integrity checks.

Kelly does not need to redo Android/iOS registrations, developer account verification, device trust/Developer Mode, or current provider connections. Present future user-dependent actions directly when needed.

## Source and current iOS package — 11 September, 21:00 AEST

`output/production-validation/ios-source-cleanup-current/receipt.json`: latest archive/IPA has exactly 92 renderer resources, 13 approved audio clips, 13 native Swift notices and 47 JS package notices. Strict signatures/configuration pass; prior studies/denied sounds absent. Same one-device development profile, no uploads or provisioning changes. IPA SHA-256: `2fb5dad725577a4dfc3991c775efa9192fd53587775e218536df5ac9bdeba907`.

`output/publication-audit/`: Gitleaks 8.30.1 from official checksummed release, proposed-source scan zero findings/private paths; four isolated self-tests prove clean acceptance, source-token rejection, deleted-token history detection and rejection of force-staged private files. Fresh source-only npm ci/build/static build pass (npm reports zero known vulnerabilities); all eight website checks and mascot regression pass after asset cleanup. Source publication is authorized at kellygold/weekaboo once ready, but approved audio generation-plan status remains pending. `release-checklist.md` tracks initial commit/history scan and push. New OAuth setup guide explains public native identifiers versus private user tokens; MCP extension is planned only, deferred until after this release.
