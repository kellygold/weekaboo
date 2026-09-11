# Current validation and release gaps

## Current release candidate — 12 September 2026, preview refresh fix

Runtime `bf621a9` supersedes `d3bcf4b`. Android live testing found that immediate edit → reopen → delete could submit a stale preview revision while its list refresh was pending. The shared preview now follows refreshed event data and waits before another edit/delete; an already-open draft retains its original revision and conflict protection. Missing events become unavailable without discarding the readable preview. Five focused regressions pass; the pre-fix delayed-refresh case fails as expected. Independent Claude/high review completed in 282 seconds with no blocking findings in this three-file delta.

- **Shared/browser:** 190/190 pass on the stable full rerun. Initial parallel-packaging run had 188 passes/two click timeouts with unexpected page navigation; both focused reruns passed. A generated-HTML watcher probe did not reproduce an actual page reload, so the precise external reload trigger remains unproved; no speculative watcher change was made. Raw failures remain in `output/preview-refresh-fix/`.
- **Android:** current signed APK installed in place; rapid Google UI CRUD now passes without explicit refresh, with direct readback/cleanup. Exact original three tasks and all accounts retained; instrumentation/export files removed and tablet released for the iPhone USB swap. Microsoft/iCloud CRUD and physical offline/recovery passed on the immediately preceding candidate; do not reattribute those to the newest hash. `output/production-validation/android-final-20260912/final-receipt.json`.
- **iOS:** current App Store IPA verifies with existing signing, 92 renderer files, 13 notice files and 12 reviewed privacy manifests. Current iPhone/Mini/standard-iPad simulator matrix 6/6 each, 18 total, passes. Signed export is not simulator or physical-device execution. New physical iPhone unsigned preflight matches current assets; no phone detected or installed yet. `output/preview-refresh-fix/ios-release/`, `output/production-validation/ios-20260911T231020Z/`.
- **Mac:** current signed app/DMG verify; all three providers pass actual UI create/edit/immediate-reopen/delete with direct provider readback, cleanup, restart and task/calendar-setting retention. No notarization/upload. `output/preview-refresh-fix/mac/`, `output/preview-refresh-fix/mac-live-1789168416286/receipt.json`.
- **Website:** https://weekaboo.app is published from `e679c61`, with hello@ contact, live policy/source links, 28 matching files and 8 real HTTPS browser/viewport passes. www DNS is valid, but its certificate has not yet appeared after documented reprovisioning; apex TLS works. Search Console ownership remains pending. Source/site publication does not approve native uploads.
- **Release preparation:** [Android packet](android-release-submission.md), [Google packet](google-verification-packet.md), and [SDK disclosure evidence](privacy-disclosures.md) are prepared. Microsoft token-request diagnostics are confirmed; remaining Google service/retention questions are explicit. No blanket no-collection store declaration. A 14-image store draft packet is prepared in `output/distribution-preparation/store-assets-20260912/`: icon, feature graphic and 12 synthetic shared-UI screenshots. The screenshots are browser-renderer drafts, not Android device captures; compare or replace them with final native captures before submission. Nothing uploaded.

## Google migration and discovery fix — 12 September 2026

All five new Google clients are received. Active Web, iOS and Mac private configuration and canonical Android registration files now use `weekaboo-app` (project number `124770503970`). Owner-only private backups and receipts are under `output/google-project-migration/active-cutover/`. Browser backend restarted and health200 verified. Microsoft/iCloud configuration and signing keys are preserved.

**Test-user setup completed:** Kelly added the intended accounts and completed fresh Android, Mac, browser and iOS simulator Google consent on 12 September. New-project Android audience/identity/calendar discovery, Mac consent and Google UI create/edit/delete/readback/cleanup/restart, and browser callback/identity/discovery, actual refresh grant and UI CRUD/readback/cleanup now pass. Existing accounts and calendar settings were retained; Android’s three tasks are unchanged. iOS simulator has one active Google account, three calendars and 24 fetched events; restart preserved the account, calendar settings and events. All new clients are configured; no additional client registration is needed for this direct-release test. See [migration evidence](google-project-migration.md#fresh-consent-after-test-user-setup--12-september).

**Runtime candidate `d3bcf4b`:** shared manual discovery now continues after an account fails, preserves failed-account calendars/settings, and retains its warning until discovery recovers. Three regression cases cover partial/all failure and warning persistence. Full safe suite182/182, TypeScript, exact-commit engine22/22 pass. Scoped independent Claude review completed in180seconds with no blocking findings; this is not whole-release approval.

- Android: new signed APK/AAB verified; APK installed in place on the tablet. Exact three-task backup comparison, all account sections/calendar selections retained, release inspection disabled. `output/google-project-migration/android-discovery-fix/`.
- iOS: new signed App Store IPA exported and verified;18/18 fresh iPhone/Mini/standard-iPad simulator tests pass. Retained consent simulator updated in place without data loss: `F18043A2-D6F3-4A75-9BFA-7BF07FBF5330`. Fresh new-client simulator consent and discovery now pass; physical/store execution remains unproved. `output/google-project-migration/ios-discovery-fix/receipt.json`.
- Mac: signed app/DMG rebuilt, package/mount/resource checks pass. Current Microsoft/iCloud UI create/edit/delete, provider readback, cleanup, restart, task and calendar-setting retention pass. `output/google-project-migration/mac/unchanged-providers-1789164513260/receipt.json`. Google fresh consent and live CRUD also pass; Mac is not notarized.

No binary/store upload occurred. Website publication is now authorized and completed separately; see [website evidence](website.md#publication-and-maintenance). Follow [Google migration](google-project-migration.md) for detailed evidence, prior failures and remaining consent work. Next: complete remaining platform-specific CRUD/expiry boundaries and distribution preparation. Keep direct-APK evidence separate from Play-installed signing acceptance.

Updated 12 September 2026. Runtime candidate source: `bf621a9`; the d3bcf4b section above is the earlier migration checkpoint. Subsequent privacy-policy, documentation and packaging-verifier changes do not change the installed native apps. Historical attempts and earlier artifact boundaries are preserved in [validation checkpoints](history/validation-checkpoints-through-2026-09-11.md).

Public source is live at https://github.com/kellygold/weekaboo. The static website is public; native binaries and store releases are not published or production-approved. Follow [release checklist](release-checklist.md) and [execution plan](release-execution-plan.md).

## Current candidate evidence

| Surface | Proved | Remaining boundary |
| --- | --- | --- |
| Shared React/TypeScript | 190 tests pass; phone header/toolbar overlap corrected; 375/390px Chromium and WebKit editor/settings/account access checks pass | Firefox unavailable in the initial all-browser run; native keyboard/real consent not established by browser fixtures |
| Android tablet | Current bf621a9 signed APK installed in place; exact original three-task export retained; all accounts preserved; rapid Google UI CRUD/readback/cleanup passes; release WebView inspection disabled | Real offline restart/recovery and actual MSAL fallback passed on the immediately preceding packaging candidate. Current-hash rapid Google write proof and account retention pass; no new-hash Microsoft/iCloud live or physical offline claim |
| Android packaging | Locked runtime graph; 91 records, 153 native notice files, zero unresolved; ten collector tests; APK/AAB signature/notice checks and bundletool validation pass | Play-delivered certificate, tester track and store acceptance still unproved |
| iOS/iPadOS | Current 26.5 simulator matrix: iPhone 17 Pro, Mini A17 Pro, standard iPad A16 each six core/UI passes, 18 total. Current App Store distribution IPA exported; strict signature, non-debuggable distribution profile, 92 renderer resources and 13 native notices across ten packages verified | Simulator tests are not tests of the exported IPA. No TestFlight upload, physical iPhone/larger iPad or minimum-OS acceptance |
| Previous physical iPad Mini | All three providers connected and live CRUD/readback/cleanup passed. Release task lifecycle, real Wi-Fi-off restart/cache/recovery, isolated Keychain/SQLite/network tests passed. UI task export/import and picker cancel exercised | Older artifact, device now sold and permanently unavailable. Lock/unlock/expiry unproved. Remaining local backup-file cleanup explicitly waived before factory reset |
| Mac Apple Silicon | Current signed app/DMG; exact 74 renderer files; isolated package/install/replacement/task export/import proof passes | Not notarized; downloaded quarantine/Gatekeeper, Intel and minimum macOS acceptance unproved |
| Mac live provider evidence | Current signed package: fresh new-project Google consent and UI CRUD/readback/cleanup/restart pass. Microsoft/iCloud current-package CRUD passed separately; settings/tasks retained | Prior injected outage is not a physical network-off test. Ordinary silent acquisition does not prove true token expiry |
| Website | Public apex site;28 matching files and eight live Chromium/WebKit checks including320px, source links, interaction/audio/local assets and no external requests | Public HTTPS deployment verified on the apex; www certificate reprovisioning pending. No public binary URLs |
| iOS privacy | Twelve manifests matched reviewed declarations in both archive and exported IPA. Seven negative/encoding/SDK-lock verifier tests pass. Bounded source/API inventory found no concrete missing app-owned declaration | Packaging retention is not full API coverage or store-label approval. SDK-specific disclosure questions remain in privacy-disclosures.md |

## Exact native artifacts

Version **0.1.0 / build 1**. Consolidated private manifest: `output/distribution-candidate/manifest.json` and `SHA256SUMS`.

| Artifact | SHA-256 |
| --- | --- |
| Android APK | `8688ff1ae311a28c56e2bd04ca5c59e84db53a31022e3daac8055a135945699d` |
| Android AAB | `05b591e960d9cf798cbe081218eb6e39817777c902eb14109fdc903ee3a3b2ad` |
| iOS distribution IPA | `eb19364a01dd6d0fa737e5a6a448ec06031385c6fa9b72b2a08939e78fe73168` |
| Mac signed DMG | `63bf6f48338192cdd1923bc9469a5dd76a4e473e348610dcf0149875198effdb` |

Paths: `android/app/build/outputs/apk/release/app-release.apk`, `android/app/build/outputs/bundle/release/app-release.aab`, `output/preview-refresh-fix/ios-release/export/App.ipa`, and `output/standalone-desktop/Weekaboo-0.1.0-arm64-signed-preview.dmg`.

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

A fresh, explicitly bounded release-validation session on 12 September reviewed the same four-file cancellation delta against clean `e679c61`. One Claude Opus/high invocation completed in251seconds of480 with no confirmed P0/P1. Both queued-interactive and post-store-read cancellation races are closed by the reviewed code. This resolves the scoped independent follow-up; it is static review, not whole-release/device acceptance. Prior timeout receipts remain preserved. Evidence: `output/production-validation/cancellation-final-review-20260912/`.

## Remaining release gates

- Complete true expiry/revocation/reconnect, recurrence/DST and ambiguous-write matrix without revoking working user accounts or touching real events. Use isolated/synthetic fixtures and verify cleanup.
- Complete independent final review, user-facing acknowledgments access and platform-specific privacy disclosures.
- Prepare Play App Signing/tester track, App Store Connect/TestFlight record/listings/screenshots and exact upload manifest.
- Obtain Mac notarization/stapling and downloaded Gatekeeper proof after concrete approval; state Apple Silicon-only support until broader support is verified.
- Finish remaining platform write/lifecycle checks; fresh Google consent on Android, Mac, browser and iOS simulator passes and identifies Weekaboo. Preserve Instapie and its unrelated clients.
- Finish unavailable physical/minimum-OS acceptance honestly. No new registration is needed to continue independent work.
- Obtain final publication approval for reviewed binaries/store uploads. Static website publication is complete; preserve existing domain email records.
