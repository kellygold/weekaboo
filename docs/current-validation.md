# Current validation and release gaps

## Google migration and discovery fix — 12 September 2026

All five new Google clients are received. Active Web, iOS and Mac private configuration and canonical Android registration files now use `weekaboo-app` (project number `124770503970`). Owner-only private backups and receipts are under `output/google-project-migration/active-cutover/`. Browser backend restarted and health200 verified. Microsoft/iCloud configuration and signing keys are preserved.

**Test-user setup completed:** Kelly added the intended accounts and completed fresh Android, Mac, browser and iOS simulator Google consent on 12 September. New-project Android audience/identity/calendar discovery, Mac consent and Google UI create/edit/delete/readback/cleanup/restart, and browser callback/identity/discovery, actual refresh grant and UI CRUD/readback/cleanup now pass. Existing accounts and calendar settings were retained; Android’s three tasks are unchanged. iOS simulator has one active Google account, three calendars and 24 fetched events; restart preserved the account, calendar settings and events. All new clients are configured; no additional client registration is needed for this direct-release test. See [migration evidence](google-project-migration.md#fresh-consent-after-test-user-setup--12-september).

**Runtime candidate `d3bcf4b`:** shared manual discovery now continues after an account fails, preserves failed-account calendars/settings, and retains its warning until discovery recovers. Three regression cases cover partial/all failure and warning persistence. Full safe suite182/182, TypeScript, exact-commit engine22/22 pass. Scoped independent Claude review completed in180seconds with no blocking findings; this is not whole-release approval.

- Android: new signed APK/AAB verified; APK installed in place on the tablet. Exact three-task backup comparison, all account sections/calendar selections retained, release inspection disabled. `output/google-project-migration/android-discovery-fix/`.
- iOS: new signed App Store IPA exported and verified;18/18 fresh iPhone/Mini/standard-iPad simulator tests pass. Retained consent simulator updated in place without data loss: `F18043A2-D6F3-4A75-9BFA-7BF07FBF5330`. Fresh new-client simulator consent and discovery now pass; physical/store execution remains unproved. `output/google-project-migration/ios-discovery-fix/receipt.json`.
- Mac: signed app/DMG rebuilt, package/mount/resource checks pass. Current Microsoft/iCloud UI create/edit/delete, provider readback, cleanup, restart, task and calendar-setting retention pass. `output/google-project-migration/mac/unchanged-providers-1789164513260/receipt.json`. Google fresh consent and live CRUD also pass; Mac is not notarized.

No binary/store upload or site deployment occurred. Follow [Google migration](google-project-migration.md) for detailed evidence, prior failures and remaining consent work. Next: complete remaining platform-specific CRUD/expiry boundaries and distribution preparation. Keep direct-APK evidence separate from Play-installed signing acceptance.

Updated 12 September 2026. Runtime candidate source: `d3bcf4b`. Subsequent privacy-policy, documentation and packaging-verifier changes do not change the installed native apps. Historical attempts and earlier artifact boundaries are preserved in [validation checkpoints](history/validation-checkpoints-through-2026-09-11.md).

Public source is live at https://github.com/kellygold/weekaboo. Native binaries, website and store releases are not published or production-approved. Follow [release checklist](release-checklist.md) and [execution plan](release-execution-plan.md).

## Current candidate evidence

| Surface | Proved | Remaining boundary |
| --- | --- | --- |
| Shared React/TypeScript | 182 tests pass; phone header/toolbar overlap corrected; 375/390px Chromium and WebKit editor/settings/account access checks pass | Firefox unavailable in the initial all-browser run; native keyboard/real consent not established by browser fixtures |
| Android tablet | Current signed APK installed in place; pulled installed bytes match; exact original three-task export retained; all three accounts preserved; release WebView inspection disabled on normal user OS | Real offline restart/recovery and actual MSAL fallback passed on the immediately preceding packaging candidate. Final-hash new-project Google consent/restart now pass; no second final-hash offline claim |
| Android packaging | Locked runtime graph; 91 records, 153 native notice files, zero unresolved; ten collector tests; APK/AAB signature/notice checks and bundletool validation pass | Play-delivered certificate, tester track and store acceptance still unproved |
| iOS/iPadOS | Current 26.5 simulator matrix: iPhone 17 Pro, Mini A17 Pro, standard iPad A16 each six core/UI passes, 18 total. Current App Store distribution IPA exported; strict signature, non-debuggable distribution profile, 92 renderer resources and 13 native notices across ten packages verified | Simulator tests are not tests of the exported IPA. No TestFlight upload, physical iPhone/larger iPad or minimum-OS acceptance |
| Previous physical iPad Mini | All three providers connected and live CRUD/readback/cleanup passed. Release task lifecycle, real Wi-Fi-off restart/cache/recovery, isolated Keychain/SQLite/network tests passed. UI task export/import and picker cancel exercised | Older artifact, device now sold and permanently unavailable. Lock/unlock/expiry unproved. Remaining local backup-file cleanup explicitly waived before factory reset |
| Mac Apple Silicon | Current signed app/DMG; exact 74 renderer files; isolated package/install/replacement/task export/import proof passes | Not notarized; downloaded quarantine/Gatekeeper, Intel and minimum macOS acceptance unproved |
| Mac live provider evidence | Current signed package: fresh new-project Google consent and UI CRUD/readback/cleanup/restart pass. Microsoft/iCloud current-package CRUD passed separately; settings/tasks retained | Prior injected outage is not a physical network-off test. Ordinary silent acquisition does not prove true token expiry |
| Website | Current privacy copy; eight Chromium/WebKit desktop/tablet/phone checks including 320px, GitHub links, interaction/audio/local assets and no external requests | Built locally only; no domain deployment or public binary URLs |
| iOS privacy | Twelve manifests matched reviewed declarations in both archive and exported IPA. Seven negative/encoding/SDK-lock verifier tests pass. Bounded source/API inventory found no concrete missing app-owned declaration | Packaging retention is not full API coverage or store-label approval. SDK-specific disclosure questions remain in privacy-disclosures.md |

## Exact native artifacts

Version **0.1.0 / build 1**. Consolidated private manifest: `output/distribution-candidate/manifest.json` and `SHA256SUMS`.

| Artifact | SHA-256 |
| --- | --- |
| Android APK | `6375916540def198d2cde410a37d9391e0bbad9d556cd641e9d979a557639dba` |
| Android AAB | `3a8315345d47d55717355fcd715c34da9dc2fbc1bdcb74f24a831382c699335e` |
| iOS distribution IPA | `ccb500ceff5e88fdf74c92fc29953778c2014f39fe260ac17cbd4b6f45106feb` |
| Mac signed DMG | `0ed87a7776100ea2e5e4201eda11c589a3c5927c0de01af05f9f92f79262ed63` |

Paths: `android/app/build/outputs/apk/release/app-release.apk`, `android/app/build/outputs/bundle/release/app-release.aab`, `output/google-project-migration/ios-discovery-fix/app-store/export/App.ipa`, and `output/standalone-desktop/Weekaboo-0.1.0-arm64-signed-preview.dmg`.

The old one-device development IPA and the earlier managed-signing probe are superseded, not distribution candidates. Existing Apple signing now works; no new client registration or membership is needed. App Store export is not an upload and cannot be installed by simply opening the IPA on an arbitrary iPhone.

## Private receipts

- Shared: `output/production-validation/shared-current.log`, `phone-layout-webkit.log`. Initial Firefox launch failures retained separately.
- Android: `output/production-validation/android-tablet-current/final-upgrade.json`, `receipt.json`, `final-notices.json`, `final-bundletool.log`; `android-bundletool-proof.json`. Unique exported task copies and temporary instrumentation package removed from tablet; private Mac copies retained. Wi-Fi restored and normal app reopened.
- iOS: `output/production-validation/ios-app-store-current/receipt.json`; `ios-20260911T121155Z/matrix.json`; `ios-privacy-audit/{receipt,repeatable-archive,repeatable-export}.json`.
- Prior iPad: `output/production-validation/ipad-physical/` includes live, Release and file-flow outcomes plus waived cleanup. Do not use the sold device.
- Mac: `output/standalone-desktop/{dmg-signed,dmg-mounted-proof,packaged-signed-proof,install-lifecycle}.json`; previous live proof at `output/production-validation/mac-live-1789122830734/receipt.json` and `mac-recovery/receipt.json`.
- Website: `output/site-validation/results.json`; `output/production-validation/site-privacy-current.log`.
- Source: `output/publication-audit/` and committed-source audit logs. Scan source and all refs before each public push; private screenshots, account labels, tasks and credentials never enter source.

## Independent review boundary

Scoped Android packaging review of `45ede45` against `8e9e82f` completed in 209 seconds with no blocking findings. It covers dependency/notice/signing changes, not whole-product readiness.

The earlier cancellation review found a queued-interactive race; the author fixed it, proved the regression fails pre-fix and passes current code, and passed packaged cancellation/retry. Follow-up exhausted the original eight-minute review budget without a verdict. Do not silently retry within the same work session or claim final independent approval. See `connection-cancel-review-status.json` and `connection-cancel-delta-review-status.json` in private validation output.

## Remaining release gates

- Complete true expiry/revocation/reconnect, recurrence/DST and ambiguous-write matrix without revoking working user accounts or touching real events. Use isolated/synthetic fixtures and verify cleanup.
- Complete independent final review, user-facing acknowledgments access and platform-specific privacy disclosures.
- Prepare Play App Signing/tester track, App Store Connect/TestFlight record/listings/screenshots and exact upload manifest.
- Obtain Mac notarization/stapling and downloaded Gatekeeper proof after concrete approval; state Apple Silicon-only support until broader support is verified.
- Finish remaining platform write/lifecycle checks; fresh Google consent on Android, Mac, browser and iOS simulator passes and identifies Weekaboo. Preserve Instapie and its unrelated clients.
- Finish unavailable physical/minimum-OS acceptance honestly. No new registration is needed to continue independent work.
- Obtain final publication approval for reviewed binaries/store uploads and static website deployment. Preserve existing domain email records.
