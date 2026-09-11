## Website and physical iPad handoff — 11 September 2026

- Custom static site implemented in `website/`; dependency-free `npm run site:build` outputs only allowlisted public assets to `dist-site/`. Local preview on port 5190. No publication, remote creation or DNS changes. Source/download URLs remain blank pending actual public destinations. See `docs/website.md` and inactive `website/github-pages.yml.example`.
- Site verifier passed **8 browser/viewport combinations** (Chromium/WebKit × desktop/tablet/390px/320px), under a GitHub project-style subpath. Navigation, sample views/tasks, mascot audio, reduced motion, resource loads and horizontal overflow checked. Evidence: `output/site-validation/results.json` and screenshots. These are website checks, not native provider parity evidence.
- Physical iPad Mini 6 (iPad14,2), iPadOS 26.6.2, detected and trusted. Developer Mode initially disabled; Kelly is now restarting it to enable Developer Mode and will unlock/confirm before leaving. Recheck device state before installation. No app installed yet.
- Fixed missing app scheme: added shared `Weekaboo.xcscheme` with normal run/archive actions; `scripts/ios.sh` now uses it rather than nonexistent `App`. Validation scheme retained. `npm run ios:simulator` **build succeeded**. Actual-device build previously stopped because Developer Mode was disabled; generic signing attempt reported no registered team device/profile. Retry against connected device with automatic provisioning; do not treat that earlier generic attempt as a final signing diagnosis.
- Logs: `output/production-validation/ipad-physical/`. No physical iOS consent or provider write proof yet. Existing 18-test iPhone/Mini/standard-iPad simulator receipt remains historical evidence; no full rerun was claimed for the scheme-only change.
- Kelly asks to keep working while away, with equal feature quality across platforms, and explicitly invites Mac packaging work. Existing signed arm64 Mac app/preview DMG are already implemented; inspect/rebuild/test them rather than starting another desktop architecture. Real Mac provider consent, notarization, install/update acceptance remain separate gates.

## Latest checkpoint — 11 September 2026, release preparation

- **User-confirmed:** Play developer identity verified; `app.weekaboo.calendar` and dedicated release certificate registered. No store listing/submission implied.
- **Current debug device proof:** Google and iCloud UI create/edit/delete, independent provider readback and synthetic cleanup pass on APK SHA256 `f3349eadbef269a881c0132a56374415b53a29726df6da94d4f8cda0eeec7e35`. Microsoft earlier live proof remains valid at its recorded artifact; do not label it a new same-artifact rerun.
- Receipts: `output/production-validation/physical-google-live-pass.json`, `physical-icloud-live-pass.json`, `physical-microsoft-live-pass.json`. First iCloud attempt matched duplicate calendar labels and stopped before sending; its unsaved synthetic draft was explicitly discarded. Successful retry used an unambiguous calendar.
- **159 shared/browser tests pass** after Google cancelled-resource reconciliation and retained create-history fixes. Recovery copy is now user-facing and installed. Current emulator write/recovery/lifecycle passed. Task export/import/reimport/cancel and HTTP follow-up now exit successfully after assertions and cleanup (`android-followup-checks.json`); original task runner timeout is retained as a harness issue.
- Signed release APK/AAB built with new dedicated release identity; APK certificate, non-debuggable manifest and Microsoft signer-derived callback independently checked. `output/production-validation/android-release-candidate.json` ties artifacts to checksums. Installed on physical tablet at Kelly’s explicit request after verified task/settings backup; not uploaded. Account sign-in underway; task restore pending. Google/MS release signer console entries supplied by Kelly; Google downloaded record imported privately. Actual release native consent remains unproved.
- Android debug-to-release signature changes cannot be installed as an ordinary update. Preserve/export user tasks and reconnect accounts when intentionally transitioning; never uninstall physical app as a testing shortcut. Release-to-release update acceptance still required.
- Full iOS simulator rerun passed six tests on each of three form factors (`ios-20260911T075015Z`); it precedes the final Google retained create-history change. Scoped transport/Google-deletion review returned no findings, but its assumption that cancelled Google records always omit dates is contradicted by live evidence. Subsequent Google create-history preservation and signing changes still need independent review; no complete release approval. Physical iOS consent/signing remains pending.

# Production validation ledger

Updated 11 September 2026. **Not ready for public production deployment.** This records executed coverage, limitations and cleanup; a build or simulator pass does not establish live-provider parity.

## Current coverage

| Target | Executed | Still unproved |
| --- | --- | --- |
| Browser/shared React | 157 shared/browser tests passed, including delayed-response loading, failure cleanup, overlapping view requests and reduced motion. | Standalone browser provider access; existing Python development adapter remains. |
| Physical Android 14, Lenovo TB350FU | Google connected with six calendars, Microsoft with one; native discovery/read. Synthetic Microsoft full create/edit/delete with provider readback, stale-revision rejection and GET-404 cleanup. Global tap-highlight removal verified on all 130 rendered controls in the latest installed APK. | Complete live CRUD cycle for Google, native iCloud account, touch/offline/background/device-release matrix. |
| Android API 36 emulator | Current build: all three fixture provider write cases, recovery and lifecycle pass. Real task export/import/cancel exercised, synthetic task/file cleanup verified. | Latest file-picker rerun is flaky: second import selection timeout; resolve before calling this run complete. Fixture HTTP/SDK are not live provider proof. |
| iPhone 17 Pro simulator, iOS 26.5 | Installed app: create task, restart/persist, complete/delete; account setup navigation; day/4-day/week/month; portrait/landscape settings. Three UI tests passed; three app-hosted native core tests now pass (SQLite, Keychain, invalid transport). | Full combined repeat after test-host correction, native OAuth registrations/live consent, Files workflows, physical device and signing. |
| iPad Mini A17 Pro + iPad A16 simulators, iOS 26.5 | Same three tests passed on both sizes, portrait and landscape. Full-screen landscape screenshots inspected after correcting XCTest capture. | Exact older iPad hardware/OS, multitasking window sizes, accessibility and physical/provider checks. Current deployment minimum iOS 17. |
| macOS arm64 | Latest shared layout build and Electron foundation pass: task restart, OS vault, SQLite, isolation, native authorization negative path, mocked chooser plus real file I/O, unauthenticated live iCloud 401. Prior Developer ID signed app/DMG proof remains historical. | Latest signed artifact, live Google/Microsoft consent, actual chooser UI, notarization, clean install/update, release assets/licensing. |

## Evidence

All below are ignored local evidence; no credentials belong in them.

- `output/production-validation/physical-account-status.json`: account health/counts only.
- `physical-live-outlook-conflict.json`: Microsoft changed changeKey/ETag between creation and later GET. No PATCH sent on the stale revision. Synthetic event removed conditionally and GET 404 verified. Top-level cleanup flag in this early receipt represented entire-suite completion; per-provider cleanup records the successful deletion.
- `physical-live.json` / `.log`: latest live attempt. Read status and cleanup together, not just process exit. One earlier run hit network failure on GET; cleanup still succeeded. No user meetings/attendees modified.
- `ios-matrix.json`, `iphone-ui.xcresult`, `ipad-mini-ui.xcresult`, `ipad-ui.xcresult`: nine initial test executions passed in total (three on each device).
- `ios-20260911T033521Z/`: all three rotation/view tests passed after full-screen XCUIScreen capture fix; screenshots exported. Earlier full-capture compile attempt used an invalid XCUIDevice API, caught and corrected; not product failure.
- `post-layout-regression.log`: 154 shared/browser tests passed.
- `refresh-full-tests.log`: 157 shared/browser tests passed.
- `android-tap-highlight.json`: latest installed tablet build, all 130 rendered controls have transparent tap highlight; selected backgrounds retained.
- `ios-20260911T035036Z/`: three app-hosted native core tests passed on iPhone.
- `physical-microsoft-live-pass.json`: Microsoft full CRUD and cleanup pass; subsequent Google failure is a separate provider result.
- `android-checks.json`: actual per-script pass/fail; do not summarize as all green until fixed.
- `mac-foundation.log`: latest local development-shell verification, not latest DMG.

## Findings and fixes

1. Android Google SDK returned a token without an account reference. The narrow Android adapter now uses verified provider identity before completing first connection; existing account renewal retains stable-subject checks. Four regression tests and physical connection pass.
2. iOS bridge protocol conformance and MSAL account lookup did not compile. Explicit plugin method array types and supported account lookup fixed compilation; installed simulator UI runs now pass.
3. iPhone controls overlapped the camera/status area and small inputs triggered WebKit focus zoom. Shared safe-area/viewport and touch input font fixes verified visually; no separate iOS UI fork.
4. iPad Mini New event label wrapped unnecessarily. Keep it on one line. Screenshot capture uses XCUIScreen, since app-only screenshots cropped landscape using portrait bounds.
5. Calendar refresh lacked visible progress. Shared footer now spins and announces “Refreshing calendars…” through initial load, manual discovery+event fetch, view changes, foreground reload and polling. Existing events remain while loading; concurrent clicks are disabled. Superseded requests cannot clear the active view's progress. Reduced motion keeps the text without rotation. Physical Android spinner and macOS foundation verified; latest combined iOS repeat remains pending.
6. Live Outlook changed its revision after creation. Keep optimistic concurrency checks; test explicit refresh and reopen before retrying. The earlier test reopened before the entire multi-account refresh settled. The new shared progress state also makes that boundary observable. Do not automatically replace ETags to force an edit.

## Independent review

`google-auth-review/` contains a distinct scoped Claude Opus review of the Android Google fix (370s, completed). No substantive introduced defect was reported. **Limitation:** the reviewer lacked git-diff access and reviewed resulting source/tests/context; this is not complete introduced-diff certification. The older desktop review timed out and has no approval. Full candidate review remains a release gate.

## Reproduce / continue

- Shared: `npm test`, `npm run build`.
- Android: `npm run android:debug`; update existing package with `adb install -r` (never uninstall the user's tablet). `scripts/verify-android-live.mjs` requires the explicit physical test serial and only writes uniquely named synthetic events with no guests. Its mutation guard and cleanup receipt are mandatory. Do not run other Android automation concurrently with a live run; shared device discovery/driver setup can interfere.
- iOS: `npm run ios:sync`, then `python3 scripts/verify-ios-simulators.py`. Runner creates/reuses only dedicated Weekaboo Validation simulators, resets their synthetic app state, exports screenshots and writes timestamped results. `--only-testing AppUITests/WeekabooUITests/testRotationAndCalendarViews` runs the bounded visual slice. No real accounts in these simulators.
- macOS: `npm run build:desktop`, `node scripts/verify-desktop-foundation.mjs`; package and inspect exact archive separately.

Continue Android live acceptance first; iOS simulators do not use the single USB port. Keep Android attached until its physical run is done, then request the iPhone cable swap. Full Xcode and account sign-in are already completed. Remaining registration inputs are listed at the top of `user-dependencies.md` and must also be explained directly to Kelly when needed.

No publishing, cloud hosting, store fees, notarization upload or production calendar mutation is implied by these checks. Tasks remain device-local with explicit export/import.


## Account connection feedback — 11 September follow-up

Shared suite: 167 passed (`account-feedback/shared-tests-final.log`). Added consistent connecting/connected feedback for all providers, browser redirect/Back recovery, stale-success cleanup, missing-account negative proof and phone/reduced-motion rendering. Android native iCloud fixture verifies delayed progress, completed account discovery, encrypted-vault versus metadata separation and cleanup. These provider responses are synthetic; previous live provider evidence remains separately bounded by artifact.

Physical release updated in place with matching certificate and checksum (`account-feedback/installed-release.json`); no account reset. Three backed-up tasks imported through native file picker and export-readback verified (`account-feedback/task-restore.json`). Latest APK/AAB paths and hashes are in `android-release-candidate.json`. Package check found no private-key/env assets, no dev server URL and logging disabled. iOS assets synced and iPad Mini follow-up passed all six installed-app/core tests (`ios-20260911T082516Z`); full release/physical Apple proof remains pending. Credential source-review findings and their disposition: [credential security review](credential-security-review.md).

## Evening device/site continuation — 11 September 2026

- Full current shared regression: **167 pass**, `output/production-validation/current-shared-tests.log`.
- Physical iPad Mini all three connections user-confirmed; connected-account XCTest **1 pass** with screenshot/AX receipts. First guarded live run: **Microsoft and Google create/edit/delete readback pass**, cleanup true for both. iCloud create/readback succeeded but edit UI interaction timed out before an outgoing edit; safety cleanup verified deleted. This is an unresolved validation finding, not an iCloud parity pass. Original detailed receipt preserved as `ipad-physical/live/first-three-provider-run.json`.
- iPad inspector bridge works with Web Inspector enabled, without Remote Automation. A later inspector reattachment failed its identity preflight without a mutation. Restart bridge and target before retry; maintain target guard. Never infer provider success from just app UI.
- Signed Mac DMG: mount/signature/archive/license/private-file checks pass. New `scripts/verify-desktop-install.mjs` copies app from DMG into an isolated Applications directory, exercises views, native task export, bundle replacement/process restart, completion/delete and native import restoring task ID. **All six stages pass**; receipt `output/standalone-desktop/install-lifecycle.json`. File chooser selections automated. This is not notarization/Gatekeeper download acceptance or live Mac provider consent.
- Website revised per Kelly's review: privacy hero, flexible undated tasks, manual calendar contexts, bidirectional sync, proper artwork/icons, no development qualifiers. All 8 Chromium/WebKit viewport combinations pass; local-only preview. Download/source links absent until real URLs exist. Distribution gates remain internal.
