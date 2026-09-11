# Current validation and release gaps

Updated 11 September 2026. Runtime candidate source: `d824b4d`. Subsequent privacy-policy, documentation and packaging-verifier changes do not change the installed native apps. Historical attempts and earlier artifact boundaries are preserved in [validation checkpoints](history/validation-checkpoints-through-2026-09-11.md).

Public source is live at https://github.com/kellygold/weekaboo. Native binaries, website and store releases are not published or production-approved. Follow [release checklist](release-checklist.md) and [execution plan](release-execution-plan.md).

## Current candidate evidence

| Surface | Proved | Remaining boundary |
| --- | --- | --- |
| Shared React/TypeScript | 182 tests pass; phone header/toolbar overlap corrected; 375/390px Chromium and WebKit editor/settings/account access checks pass | Firefox unavailable in the initial all-browser run; native keyboard/real consent not established by browser fixtures |
| Android tablet | Current signed APK installed in place; pulled installed bytes match; exact original three-task export retained; all three accounts preserved; release WebView inspection disabled on normal user OS | Real offline restart/recovery and actual MSAL fallback passed on the immediately preceding packaging candidate. No second final-hash offline or live-consent claim |
| Android packaging | Locked runtime graph; 91 records, 153 native notice files, zero unresolved; ten collector tests; APK/AAB signature/notice checks and bundletool validation pass | Play-delivered certificate, tester track and store acceptance still unproved |
| iOS/iPadOS | Current 26.5 simulator matrix: iPhone 17 Pro, Mini A17 Pro, standard iPad A16 each six core/UI passes, 18 total. Current App Store distribution IPA exported; strict signature, non-debuggable distribution profile, 92 renderer resources and 13 native notices across ten packages verified | Simulator tests are not tests of the exported IPA. No TestFlight upload, physical iPhone/larger iPad or minimum-OS acceptance |
| Previous physical iPad Mini | All three providers connected and live CRUD/readback/cleanup passed. Release task lifecycle, real Wi-Fi-off restart/cache/recovery, isolated Keychain/SQLite/network tests passed. UI task export/import and picker cancel exercised | Older artifact, device now sold and permanently unavailable. Lock/unlock/expiry unproved. Remaining local backup-file cleanup explicitly waived before factory reset |
| Mac Apple Silicon | Current signed app/DMG; exact 74 renderer files; isolated package/install/replacement/task export/import proof passes | Not notarized; downloaded quarantine/Gatekeeper, Intel and minimum macOS acceptance unproved |
| Previous Mac live provider evidence | All three user sign-ins, UI create/edit/delete and direct readback/cleanup; account restart retention; injected provider outage/cache/recovery without consent | Earlier binary; injected outage is not a physical network-off test. Ordinary silent acquisition does not prove true token expiry |
| Website | Current privacy copy; eight Chromium/WebKit desktop/tablet/phone checks including 320px, GitHub links, interaction/audio/local assets and no external requests | Built locally only; no domain deployment or public binary URLs |
| iOS privacy | Twelve manifests matched reviewed declarations in both archive and exported IPA. Seven negative/encoding/SDK-lock verifier tests pass. Bounded source/API inventory found no concrete missing app-owned declaration | Packaging retention is not full API coverage or store-label approval. SDK-specific disclosure questions remain in privacy-disclosures.md |

## Exact native artifacts

Version **0.1.0 / build 1**. Consolidated private manifest: `output/distribution-candidate/manifest.json` and `SHA256SUMS`.

| Artifact | SHA-256 |
| --- | --- |
| Android APK | `3fb084b4430bb15451feae413022b45816b1d1664952a8ddac4257daeb1a12b0` |
| Android AAB | `f02f5d9acd264e7fc400f61bd2aebd4efa62e0d30240318ed5ace6a1aa2bec0b` |
| iOS distribution IPA | `50b8069b1fce153370697b2ca1dce872ab8ebabba12f7b9c073776c4ff83b98d` |
| Mac signed DMG | `8d5afee50b0e78d27eec388adebbbb23ea7a1284bac88ad23c02e9174ad50898` |

Paths: `android/app/build/outputs/apk/release/app-release.apk`, `android/app/build/outputs/bundle/release/app-release.aab`, `output/production-validation/ios-app-store-current/export/App.ipa`, and `output/standalone-desktop/Weekaboo-0.1.0-arm64-signed-preview.dmg`.

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
- Resolve Google consent branding still showing Instapie through a deliberate project decision that preserves the other app.
- Finish unavailable physical/minimum-OS acceptance honestly. No new registration is needed to continue independent work.
- Obtain final publication approval for reviewed binaries/store uploads and static website deployment. Preserve existing domain email records.
