## Latest completed checks — 11 September, evening continuation

## 11 September 2026 — public source repository created

Kelly confirmed paid-plan coverage for the13 approved audio clips. Source/history scan passed, then public https://github.com/kellygold/weekaboo was created and reviewed source pushed. MIT recognized; secret scanning/push protection/private vulnerability reporting enabled. Website GitHub links added and all8 browser/layout checks pass with destination assertions. No Pages/DNS/native-binary/store deployment. Continue native release checklist; do not repeat registration or source-publication approval.


## 11 September 2026, 21:00 AEST — release preparation checkpoint

Mac live CRUD/restart/outage tests remain passed at their exact signed hash. Current iOS archive/IPA now includes all13 approved sounds,13 native Swift notices and47 JS notices, strict signatures verified; one-device development profile only. Android debug artifact includes30 original notice files, but78 unresolved components block release/bundle; signed APK unchanged. Source-only npm ci/build/site build pass, eight site checks and mascot test pass, native collectors five tests each, source audit four self-tests pass. Initial local commit4090e70 holds413 reviewed files; source/full-history Gitleaks zero findings, no remote/push. Public kellygold/weekaboo authorized once ready; audio paid-generation status is pending. README/OAuth guide and deferred MCP plan are written. The source link remains unset until repository creation; website/binary deployment remain separate approvals.


## 11 September 2026, 20:47 AEST — Mac live validation and source publication preparation

Mac all-provider UI CRUD/direct readback/cleanup and full restart pass; injected outage retains cached events and recovers without consent, tasks/settings unchanged. Connection-feedback iOS archive/IPA refreshed, still development-only. New iOS notice collector passes five tests and simulator exact-resource proof; Android native notices remain incomplete. Site now prominently says free/open-source; eight browser/layout checks pass. User authorized public kellygold/weekaboo when source is clean; first scanner pass found no secrets and no Git history exists yet. README/license/contribution/security/audit/checklist work underway. Private asset archive preserves unused concepts and rejected audio; generation-plan status is pending user clarification. See current-validation.md and release-checklist.md for current evidence/gates. Old handoff chronology moved to docs/history; physical iPad remains sold/disconnected.


## Mac provider connections complete — 11 September, 20:29 AEST

Kelly confirms Google, Microsoft and iCloud sign-in succeeded on Mac. Read-only normal-profile metadata confirms active providers, no attention flag, and 3/1/4 calendars respectively; receipt `output/production-validation/mac-connected-providers.json`. No credentials/events accessed or records changed. Initial Mac consent/discovery is complete; do not repeat registrations or ask for consent again. Next: safe synthetic live CRUD/readback/cleanup, full app restart/account retention and silent refresh. Earlier test/review/artifact boundaries remain in `current-validation.md`; independent cancellation delta review is incomplete and distribution not approved.


## Current resume point — 11 September 2026, 20:25 AEST

Microsoft desktop localhost callback registration is user-confirmed complete. Signed Mac app reopened for live Microsoft retry after adding desktop cancellation/timeout recovery and fixing cancellation queued behind silent refresh. Full shared suite 180 pass; focused 40 pass; signed packaged cancellation/retry and DMG checks pass; refreshed Android release emulator lifecycle passes; current standard iPad simulator six pass. Actual Mac provider consent remains to confirm. Independent review found one fixed race; delta review timed out within the original budget, so independent follow-up remains incomplete and public release is not approved. See `docs/current-validation.md` for receipts, artifact boundaries and remaining gates. Current iOS archive/IPA predates this feedback change; source/assets/simulator are current. Do not reuse the sold physical iPad. Do not repeat completed registrations or copy credentials.


## Mac Google token exchange fix — 11 September 2026, 20:08 AEST

Kelly reached the Google callback page, then Weekaboo showed sign-in unavailable. Reproduced at the real SDK/network boundary using synthetic invalid credentials: URLSearchParams was converted to a string without Fetch's implicit application/x-www-form-urlencoded content type; Google's token endpoint returned a JSON parse error. `desktop/auth-network.mjs` now sets the form content type only when absent, preserving caller headers, endpoint restrictions, bounded transport and no-redirect behavior. No OAuth registration changes or user-token inspection.

Seven focused authorization/loopback/network tests pass. New regression retains the actual Google SDK → custom fetch → bounded HTTPS layers, mocking only the final socket; checks form body/PKCE/redirect, explicit content type and blocked destinations. Live synthetic negative now returns expected invalid_client (401), proving form parsing is fixed without using real credentials. Prior mocks bypassed the faulty adapter, explaining the escape. All 11 desktop tests now pass (authorization/network/loopback/storage/bridge). Signed Mac app/DMG rebuilt; packaged launch/task save/provider availability checks pass. Independent Claude high-effort review completed in 124 seconds with no blocking findings (snapshot `7b2fd0be0a70bcacab482663a9534fe2f2264880`). This reviewed the small auth diff and surrounding source, not a full release; SDK dependency source was not in the review snapshot, while local regression/live-negative tests exercised the installed SDK. Quit the normal app cleanly before replacement; preserve local accounts/tasks. Corrected normal app reopened and Kelly asked directly to retry Google. Actual account consent remains unvalidated until that retry.


## Mac Google registration imported — 11 September 2026, 20:02 AEST

Kelly created/downloaded the Desktop OAuth client. Validated the installed-client JSON, official Google endpoints and loopback redirect; moved the newest matching download byte-for-byte into ignored `data/oauth/google-desktop.json` (0600). Updated ignored `desktop/native-auth.json` atomically (0600), preserved Microsoft registration, and retained prior local config privately. No credential values logged. Native config parser confirms Google and Microsoft both configured. Signed Mac app/DMG rebuilt; exact packaged UI passed task creation and all three connection-control availability checks in an isolated profile. DMG signature/archive/private-path checks and bundled notices passed. Normal app opened for Kelly to complete provider sign-in; actual consent is not established by the import. Do not ask for another Desktop client.


## Latest checkpoint — packages refreshed after iPad disconnect (11 September 2026, 20:00 AEST)

Physical iPad work remains closed; Kelly disconnected it for reset/sale. No physical device commands were run. Rebuilt browser/native/desktop renderers, signed Android APK/AAB, development iOS archive/IPA, and signed Mac app/DMG with bundled notices. A shared collector replaces duplicate desktop logic and fails builds for absent dependency notices. Verified upstream texts byte-for-byte: 44 browser / 47 mobile / 46 desktop renderer packages, 34 Mac main-process packages, Electron and Chromium notices. Native mobile SDK and final project/asset rights remain separate gates.

New repeatable checks: `verify-bundled-notices.mjs`, `verify-android-bundle.py` (pinned official bundletool, existing release key/password-file only), and actual IPA signature/configuration verification in `verify-release-artifacts.py`. APK/AAB/IPA/ASAR hashes and scope are in `output/production-validation/bundled-notices-proof.json`; refreshed universal APK in `android-bundletool-proof.json`. No credential values were logged; no upload/notarization/publication.

Latest candidate passed Android emulator restart/in-place AAB-derived upgrade/task completion/deletion/settings; normal-user-OS inspection remains unvalidated. Standard iPad simulator six tests passed (`ios-20260911T095640Z`), screenshot visually reviewed. Earlier full iPhone/Mini/standard iPad matrix remains 18 passing tests; functional source unchanged. Mac signed packaged launch/task save and read-only DMG/signature/archive checks pass. Synthetic profiles cleaned, simulator shut down. Current IPA is development-provisioned for one device, not general installation/TestFlight.

Next: Mac Google Desktop OAuth client and actual Mac provider consents (asked Kelly directly); native-mobile SDK acknowledgements, renewal/revocation/recurrence/minimum-OS matrix, public Google consent branding, store distribution and Mac notarization gates. Ten pinned iOS SPM dependency checkouts have top-level license files locally; binary/framework nested notices still need inventory rather than assuming these ten establish completeness. Keep using `current-validation.md` as the current status; older checkpoints below are historical.


## Latest checkpoint — physical iPad released (11 September, ~19:50 AEST)

Kelly is resetting/selling the iPad and explicitly waived final file cleanup. All iPad automation is stopped; no UI test runner remained. **Do not use that device again.** Final Release configuration has six passing physical tests (accounts retained, task lifecycle, real Wi-Fi-off cold launch/recovery, native SQLite/CAS, isolated Keychain policy/cleanup, unsafe-request rejection). Native export/import/task deletion worked; two backup files deleted, last cleanup interrupted by request. All provider test events/tasks removed. Read `current-validation.md` for exact receipts and remaining gates.

New renderer notice build hook inventories 47 included JS packages and preserves upstream texts; native renderer build passes, browser/desktop notice checks and signed-artifact refresh remain pending. No signed artifact or installed device includes this newest notice-only addition yet. No publication/store upload/notarization performed.


- Canonical concise status: `docs/current-validation.md`. README and user-dependency summaries updated so old scaffold/setup blockers are no longer presented as current.
- Physical iPad: all three live single-event CRUD paths have successful provider readback/cleanup evidence (Microsoft/Google first run, iCloud fresh updated run); final all-provider current-artifact run now in progress. Physical task restart/completion/delete and rotation/settings: **2 tests pass**. Separate native parity check confirms all 3 accounts / 8 calendars survive updates/restarts, Keychain synthetic round-trip+cleanup, actual randomized audio, transparent tap highlight and cached events under simulated native network failure. No user tasks remain from testing.
- Fresh simulator matrix **18 tests pass** across iPhone/Mini/standard iPad: `ios-20260911T090230Z`. Shared suite **167 pass**. Site matrix **8 pass** after latest revised copy/icons/skip-link rendering fix.
- Mac signed DMG installation lifecycle/native export-import **6 stages pass**, signature/private-path/notices checks pass. No live Mac consent or notarization claim.
- Build versions centralized at package.json **0.1.0 / 1**. Latest signed Android APK/AAB and iOS Release archive rebuilt. iPad updated preserving data. `scripts/verify-release-artifacts.py` validates actual platform artifact metadata/signatures/config boundaries. Archive is still development-provisioned; no store upload or public release.

## Active continuation — 11 September 2026, evening

- Kelly has left for food and authorized continued site revisions, iPad validation and Mac work. Web Inspector is now enabled on the trusted physical iPad Mini; Remote Automation is unnecessary. All three native accounts connected successfully by Kelly. No further setup is required to continue current checks.
- Physical iOS development build signed with existing Apple team, installed normally (no uninstall/reset), launched. `WeekabooPhysicalTests/testInspectConnectedAccounts` passed with device screenshots/AX evidence in `output/production-validation/ipad-physical/inspect.xcresult`. Google, Microsoft and iCloud all show Connected. Live provider mutation proof is in progress, not yet a pass.
- Web Inspector bridge: isolated `output/ios-tools-env` pymobiledevice3 11.6.0, `webinspector cdp --host 127.0.0.1 --port 9223`. Target filtered to Weekaboo title + capacitor://localhost + iOS platform. Credentials remain in WebView memory. Shared guarded live test now `scripts/verify-native-live.mjs`; legacy Android command delegates to it. iOS output separated under `ipad-physical/live/`.
- Shared calendar drawer now shows Loading calendars… during initial fetch instead of falsely reporting no calendars. Focused refresh/desktop tests: 13 pass. New branded iOS/Android/Mac icons generated from approved mascot by `scripts/build-app-icons.mjs`. These UI/icon updates are not yet installed on physical iPad/Android.
- Fresh signed arm64 Mac app and DMG built with branded .icns. Packaged app launch/task save and read-only DMG signature/archive/private-path/license checks pass. Real Mac Google OAuth client/consent, notarization and public distribution remain outstanding. Evidence in `output/standalone-desktop/current-*.log` and receipts.
- Website copy revised to Kelly's feedback; local preview 5190. No public source/download URLs fabricated, no publish/deploy. Latest browser matrix is running after copy changes. See `docs/website.md`.
- Deferred: Google consent says Instapie due to project branding; don't alter working OAuth registrations without a deliberate migration. No public release readiness claim.

## Website and physical iPad handoff — 11 September 2026

- Custom static site implemented in `website/`; dependency-free `npm run site:build` outputs only allowlisted public assets to `dist-site/`. Local preview on port 5190. No publication, remote creation or DNS changes. Source/download URLs remain blank pending actual public destinations. Historical local-only checkpoint; current deployment and the active workflow are documented in `docs/website.md`.
- Site verifier passed **8 browser/viewport combinations** (Chromium/WebKit × desktop/tablet/390px/320px), under a GitHub project-style subpath. Navigation, sample views/tasks, mascot audio, reduced motion, resource loads and horizontal overflow checked. Evidence: `output/site-validation/results.json` and screenshots. These are website checks, not native provider parity evidence.
- Physical iPad Mini 6 (iPad14,2), iPadOS 26.6.2, detected and trusted. Developer Mode initially disabled; Kelly is now restarting it to enable Developer Mode and will unlock/confirm before leaving. Recheck device state before installation. No app installed yet.
- Fixed missing app scheme: added shared `Weekaboo.xcscheme` with normal run/archive actions; `scripts/ios.sh` now uses it rather than nonexistent `App`. Validation scheme retained. `npm run ios:simulator` **build succeeded**. Actual-device build previously stopped because Developer Mode was disabled; generic signing attempt reported no registered team device/profile. Retry against connected device with automatic provisioning; do not treat that earlier generic attempt as a final signing diagnosis.
- Logs: `output/production-validation/ipad-physical/`. No physical iOS consent or provider write proof yet. Existing 18-test iPhone/Mini/standard-iPad simulator receipt remains historical evidence; no full rerun was claimed for the scheme-only change.
- Kelly asks to keep working while away, with equal feature quality across platforms, and explicitly invites Mac packaging work. Existing signed arm64 Mac app/preview DMG are already implemented; inspect/rebuild/test them rather than starting another desktop architecture. Real Mac provider consent, notarization, install/update acceptance remain separate gates.

# Standalone migration status

11 September 2026. This is implementation evidence, not a production release approval.

## Current continuation (read first)

Android has native Google AuthorizationClient/MSAL and the shared three-provider engine. Physical Android Google (six calendars) and Microsoft (one calendar) accounts are connected and active. iCloud native live setup is still pending. Full Xcode is installed and signed in; iOS compiles and runs in iPhone, iPad Mini and standard iPad simulators. Browser retains the existing Python adapter. Historical entries below preserve earlier findings; this table supersedes their setup blockers.

### Latest checkpoint — physical Android and iOS/iPad simulation (11 September)

| Platform | Implemented/proved now | Remaining acceptance gates |
|---|---|---|
| Browser | Existing React/Python workflow preserved; 154 shared/browser tests pass after safe-area changes | Direct-provider browser distribution deferred |
| Android | Physical Google/Microsoft accounts connected; three-provider fixture writes/recovery/lifecycle; SQLite/vault/HTTPS/file adapters; updated debug APK installed | Complete live CRUD/recovery matrix, iCloud live account, physical gestures/offline, release signing |
| iOS/iPadOS | Full Xcode 26.6; iOS 26.5 SDK; app compiles; three XCUITests passed on each of iPhone, iPad Mini and standard iPad: task lifecycle/restart, setup navigation, portrait/landscape views/settings | Google iOS registration, Microsoft callback verification, live provider consent/writes, native files/security negatives, device signing/provisioning and final physical proof |
| macOS | Electron shared engine; local signed arm64 app/DMG previously built and tested | Latest-candidate packaging proof, Google Desktop registration, Microsoft callback, live consent/writes, notarization/install/update and asset/license audit |

Current evidence is under `output/production-validation/`. See [validation coverage and remaining gates](production-validation.md). No production approval, upload or release has occurred.

- **150 passed**: `output/standalone-desktop/full-tests-final.log`. First run had one rich-notes undo click timeout (142 passed); the complete notes file then passed 12 and the next full run passed 150. No product workaround or relaxed assertion was applied. Latest focused desktop delta tests: **10 passed** in `auth-final-tests.log` (includes malformed token-expiry preservation). `final-audit.json`: zero npm advisories after pinning esbuild 0.28.2.
- Latest Android debug/bundle: `output/standalone-desktop/android-build.log`, `android-bundle.log`. Installed write replay `android-native-writes.log` passes; `output/standalone-auth/native-writes.json` has twelve confirmed operations and cleanup receipt restored=true. SDK/provider HTTP in this UI matrix were synthetic, not live consent/writes.
- Mac runtime: `auth-foundation.log` / `foundation.json` proves task capture/restart, real OS vault (mock Keychain disabled), SQLite conflict checks, sandbox/Node isolation, fixed safe error envelopes, native SDK missing-account handling, native file I/O with mocked chooser selection, real unauthenticated iCloud PROPFIND→401. Packaged app task-save proof: `auth-packaged-proof.log`, `packaged-proof.json`. App rendering was visually inspected.
- Desktop SDK transport: `auth-transport.json` exercises actual Google library through bounded HTTPS with an intentionally invalid token (400), and actual MSAL public discovery/PKCE URL construction. No browser/login opened. Fixture auth tests cover separate Google accounts, SDK refresh/restart, account/audience/scope/expiry rejection, cache failure preservation, Microsoft cache isolation, cancellation, and loopback negative/timeout cases. Microsoft positive token acquisition uses a fake SDK client and still needs a real consent run.
- Loopback exists only during system-browser sign-in, binds 127.0.0.1, validates Host/path/state, uses S256 PKCE, times out/cancels and closes. One Mac process per profile. Google/MS credentials live in a separate encrypted, bounded SDK cache; no browser-server secrets are copied. `desktop/native-auth.json` is ignored and contains Google placeholders plus existing public Microsoft client ID. See the immediate steps in user-dependencies.md.
- Packaging: esbuild emits a native-only main-process bundle; explicit input allowlist excludes backend, private data, .env and output. SDK license inventory/copies and Electron/Chromium notices ship inside the local archive. Earlier missing data-uri-to-buffer notice was found in its README and copier now preserves it. Frontend/mobile transitive licenses, own project license/owner and generated asset rights remain gates. DMG checksum/integrity receipt: `dmg.json`. It is an **ad-hoc development preview**, not a notarized/public release.
- Mac startup defects found and fixed: top-level ready-await deadlock; lost Error.code across contextBridge; hardened ad-hoc launch library validation mismatch. Ad-hoc development package disables hardened runtime. A separate existing-Developer-ID/hardened package **passed strict signature verification and isolated packaged launch/task-save** (`package-signed.json`, `packaged-signed-proof.json`). Its signed DMG also builds and verifies (`dmg-signed.json`). Read-only mount verifies the contained app signature, matching archive hash, no private repository/database paths, and notices for all 34 bundled SDK dependencies (`dmg-mounted-proof.json`); volume detached after verification. Neither is notarized or published. Main profile now explicitly belongs to Weekaboo, including a separate Chromium session subdirectory.
- Desktop independent review **timed out at 480.02 seconds without a verdict or actionable finding**, against clean snapshot `7d4997fad6a3e317a265636e616b88ee565efbbc`. One read-only Claude reviewer; original time budget exhausted, no retry/reset. See `output/standalone-desktop/auth-review/triage.md`. Post-snapshot deltas: token-expiry validation before cache commit, explicit app-owned profile, signing option and license inventory. Do not call these independently approved. Apple prior review was completed and triaged; iCloud occurrence review previously timed out. No platform is stamped production-ready.

Next: live Android consent/physical tablet first when registrations arrive; compile iOS when full Xcode exists; run the same native provider matrix on each. Desktop source and development artifacts are ready for consent testing, not a production claim. Browser final build and iOS asset sync pass (`browser-final-build.log`, `output/standalone-ios/final-source-sync.log`); iOS asset sync is not compilation. Current artifact hashes are in `output/standalone-desktop/artifact-inventory.json`. Whole-series iCloud mutation, physical/native file and lifecycle acceptance, desktop notarization/install/update, and public project/asset/license decisions remain incomplete. No new infrastructure, fees, private credential transfer or public release occurred.

Earlier evidence (historical counts retained):

- `output/standalone-icloud/repeat-full-tests.log`: **134 passed** (browser/shared/native-provider fixtures).
- `output/standalone-ios/auth-android-build.log`: latest Android debug build succeeds after shared authorization extraction. Browser build also passes (`auth-browser-build.log`).
- `native-writes.json`: Google/Microsoft/iCloud single-event CRUD in installed Android UI, twelve persisted confirmed operations, including editing/removing one iCloud occurrence without deleting siblings and creating a new named-timezone repeat. SDK/provider HTTP were synthetic. `native-writes-cleanup.json`: restored=true; temporary iCloud vault value restored/deleted. Screenshots inspected.
- `emulator-auth.json`: real SDK setup, negative/silent errors, Google cancellation and busy-lock recovery; no successful consent claim.
- `migration.json`, `native-documents.json`: SQLite 1→2 retained exact original tasks; stale/fractional CAS rejected.
- `output/standalone-icloud/review-status.json` and `triage.md`: separate iCloud read review completed with two confirmed recurrence defects, fixed and covered by 12 passing tests. Earlier auth/read review found four defects, also fixed. Deltas are not independent-review passes; no release approval.
- `output/standalone-icloud/write-tests.log`: five conditional resource-write regressions pass. `occurrence-tests.log` adds five occurrence-write cases alongside twelve reader cases (22 pass). New repeats now pass six additional regressions (`repeat-tests.log`, 17 writer tests). Whole-series writes remain unsupported; existing occurrences are editable.
- `output/standalone-ios/`: generated iOS project and sync succeeded; Apple core/bridge source is **uncompiled** because local Swift/SDK/SwiftPM are mismatched. Full Xcode required. No iOS runtime or signing proof.

Next: finish/review the prepared iOS SDK authorization source; compile it with full Xcode; prove physical/native live consent and multi-account restart/refresh. Whole-series iCloud writes remain a separate parity gap. Task transfer and pending-write recovery UI now have installed Android evidence. Android remains first priority. iOS Google/MS SDK source is now present but uncompiled; independent review is in progress. Mac packaging follows. Registration blocks live consent, not independent coding. Do not stop merely because console setup is pending.

Composition: native-bootstrap.tsx → native-runtime.ts for authorization/setup plus shared Capacitor data ports → standaloneServices/provider registry. No native `/api`, Python fallback, server or credential migration. `platform/foundation.ts` and the old Android-only data-adapter file are removed.

## Task portability and recovery continuation (11 September)

- Shared `TaskService` now supports versioned export/import and revision-checked delete. `task-backup.ts` allowlists task fields, preserves completion/civil dates/time blocks, rejects malformed/future/duplicate-ID backups before writes, appends missing tasks in rank order, and keeps local versions of conflicts. Import preview is re-evaluated inside the transaction. Repeat imports do not create duplicates. No account/cache/vault documents enter the backup.
- Settings has shared export/import preview and explicit conflict counts; task detail has inline delete confirmation. `FileExchange` is injected at composition. Browser uses a user-selected JSON file/download; Android uses ACTION_OPEN_DOCUMENT/ACTION_CREATE_DOCUMENT without broad storage permission. iOS UIDocumentPicker source added; still uncompiled pending full Xcode.
- `output/standalone-tasks/tests.log`: 13 focused task/service/browser tests pass. `android-build.log`: rebuilt APK succeeds. Installed Playwright Android driver; full native save/delete/import/reimport and both picker cancellation paths pass (`native-tasks.json`, cleanup=true). Export file read back and decoded; original task snapshot restored and synthetic file removed. `native-settings.png` inspected after system return animation.
- `output/standalone-recovery/native-recovery.json`: installed Android UI reconciles a persisted sent create through lookup, retains unsent changes on failed auth, confirms discard, blocks disconnect with uncertain writes, and permits disconnect after explicit stop-tracking. Zero remote mutations during proof; document cleanup=true. Synthetic SDK/HTTP only.
- `output/standalone-tasks/all-tests.log`: 120 pass; browser build and iOS asset sync also pass. iOS remains uncompiled.
- Independent task-transfer review completed against clean snapshot `74c4979b5e39855b6361bb382efbbd95ee93f671` with **no confirmed P0/P1 findings** (`review-status.json`, 428.8s). It noted BOM import inconsistency (normalized in shared decoder with a new test) and legacy browsers without file-input cancel events (modern tested browsers supported; no legacy promise). Review covers this slice only, not calendar writers or a full release. No source-repo commit, publication or credentials copied.
- Prior pending recovery tests resolved: `output/standalone-auth/recovery-tests.log`, 26 pass including a read/write generation fence preventing stale refresh from overwriting successful writes. Provider HTTP 400/422 are now explicit validation errors rather than uncertain network outcomes. Current Android rebuild includes this patch.

## iCloud occurrence continuation (11 September)

- `ical-target.ts` owns opaque resource/UID/original-slot targeting and resource validation. Zoned slots canonicalize to instants; civil/floating slots remain civil. Rendered occurrence IDs remain stable when moved. Existing cached recurring entries without the new command target remain read-only until refreshed.
- Editing a generated instance clones a detached VEVENT with original RECURRENCE-ID, retains alarms/attendees/unknown fields and the resource VTIMEZONE, and leaves the master unchanged. Existing moved overrides are changed in place, including mixed-zone RECURRENCE-ID. Removal writes STATUS:CANCELLED for that occurrence via original-resource If-Match PUT; it never DELETEs the series. Lookup of a canceled slot returns null for uncertain-delete reconciliation.
- EXDATE/unknown slots, stale resource ETags, ambiguous resources, missing/insufficient timezone definitions, and RANGE=THISANDFUTURE fail without a write. New repeats and whole-series edits/removal remain explicitly unsupported. Recurrence lookup retains the 20,000 expansion bound.
- `output/standalone-icloud/occurrence-tests.log`: 22 pass. `occurrence-build.log`: Android build passes. `native-occurrence-proof.log` + `output/standalone-auth/native-writes.json`: all three single-event CRUD plus existing iCloud occurrence edit/remove through installed UI, eleven confirmed operations, sibling occurrences retained. Synthetic providers only; cleanup restored documents/vault.
- Scoped independent occurrence-write review timed out at 480 seconds on snapshot `f90854fd9fb4dd729cee45243c6a7dcc9ad21bf5`, without a verdict. This is incomplete, not a pass; original review budget closed. See `output/standalone-icloud-occurrences/review-triage.md`. Shared source after BOM normalization postdates the installed APK from this occurrence proof. Latest build/test receipts will supersede it.

## Delivered in the initial foundation slice

- Stage 0: source/hash recovery snapshot and private SQLite backup in ignored `output/standalone-stage1/`. Original credential environment and encryption key unchanged. All Python source/test hashes match the baseline; the earlier 224 backend tests / 57 live assertions remain historical evidence, not a newly rerun matrix.
- Stage 1: all existing React account/calendar commands now use injected services. `src/bootstrap.tsx` composes the browser HTTP adapter; `src/services/context.tsx` supplies it to the shared UI. Event forms send typed domain changes, not backend URLs or snake-case DTOs. The same applies to account disconnect, sync, calendar settings and gesture saves.
- `src/services/contracts.ts` contains account commands, calendar reads/writes, explicit event scope/revision, settings and current task commands. Numeric backend IDs are confined to `src/calendar-api.ts`; UI command IDs are opaque strings. Render occurrence IDs deliberately retain the legacy representation until providers supply original occurrence identity. The HTTP adapter rejects supplied base revisions it cannot enforce.
- Task completion/history, capture and ranking live in `src/services/tasks.ts`. `IndexedDBTaskStore` keeps the original database/store/version and commits changes atomically. Android uses the same rules with a SQLite compare-and-swap store. No automatic cross-device sync or task migration occurred.
- Stage 2 foundation: native Capacitor Android project, separate native entry point, bundled React assets, SQLite storage, Android Keystore AES-GCM vault with per-reference authenticated data, and native HTTPS transport. No `server.url`, Python dependency, `/api/` fallback, runtime metering or Weekaboo login in the native artifact.

**Stage 1 covers current UI operations, not every future contract in the plan.** Task delete/export/import and a durable write journal are now implemented. Full provider capability discovery, lifecycle coordination and original recurrence write identities still need their remaining vertical slices. Do not mark the complete standalone architecture finished.

## Actual parity

| Capability | Browser development app | Android preview | iOS | macOS native |
|---|---|---|---|---|
| Shared React UI | Existing behavior; 134 regression tests pass | Installed tablet UI/CRUD proved with synthetic providers | Native project and shared assets generated; uncompiled | No container selected |
| Tasks | Existing IndexedDB retained | SQLite capture/offline restart plus real system-picker export/import/delete/cancel proved | Shared TS rules + Swift SQLite adapter prepared, unverified | Core Swift package may be reused; unverified |
| Provider reads | Existing Python integration | All three shared TS readers; synthetic emulator flow; live auth pending | Shared readers reusable; Apple runtime unproved | Shared readers reusable; no runtime |
| Provider writes | Existing Python integration | Google/MS and single iCloud event CRUD plus existing iCloud occurrence edit/remove fixture/emulator proof; new repeats also proved; whole-series changes pending | Shared writers reusable; unproved | Not packaged |
| Secure credentials | Backend encryption unchanged | Keystore/vault tests pass | Keychain adapter source, uncompiled | Not integrated |
| Native HTTP | Browser/dev unchanged | XML/PROPFIND/conditional headers/HTTPS/redirect checks proved | URLSession adapter source, uncompiled | Not integrated |
| Distribution | Browser build preserved | Debug APK current; unsigned AAB from earlier slice | Xcode project only; signing/profile pending | Existing Developer ID; no Weekaboo DMG |
| Production-ready | No: backend/LAN limitations | No: live consent, recurrence, recovery, physical device and release gates remain | No | No |

The sections below record historical checkpoints. The current continuation and parity table above take precedence over older task lists/counts.

## Native foundation decisions and findings

- Capacitor core/Android/CLI pinned to **8.4.3**, MIT. The initially evaluated 8.5.1 CLI pulled an xcode/uuid dependency chain with an npm advisory; 8.4.3 avoids that chain. Final `npm audit` reports zero known vulnerabilities.
- JDK 21 and Android command-line tools installed using Homebrew. Android SDK platform/build tools 36 and an API 36 ARM64 Google APIs emulator are installed under `~/Library/Android/sdk`. No shell profile or system Java/Xcode selection changed. `scripts/android.sh` sets the build environment per process.
- Package is `app.weekaboo.calendar`. Debug signing currently uses this Mac's normal Android debug key. No production signing key or store registration created.
- **CapacitorHttp on this Android runtime rejects PROPFIND.** The failed device call returned `Expected one of [OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, PATCH] but was PROPFIND`. Do not revert to it for CalDAV.
- `WeekabooHttpPlugin.java` uses **OkHttp 5.3.2**, Apache-2.0, through `AndroidHttpTransport`. Native redirects and automatic connection retries are disabled. The provider layer must validate discovery destinations before attaching credentials. OkHttp 5.5.0 required compile SDK 37; 5.3.2 builds with the selected API 36 toolchain.
- `WeekabooStoragePlugin.java` stores a version-one task snapshot and revision in SQLite. Writes compare revisions and acknowledge only after committing. Schema 2 adds a generic CAS document table used for accounts/settings and event cache. The 1→2 migration preserves task body and revision exactly on the emulator. Queue schema remains pending.
- The vault uses AndroidKeyStore AES-GCM; credential reference is authenticated additional data. Plaintext is not in preferences or task exports. Missing/corrupt keys fail rather than silently recreating a decryption key. Automatic cloud/device backup is excluded. User-driven task export remains needed before public release.
- **Capacitor debug bridge logging includes plugin arguments by default.** `loggingBehavior: 'none'` is mandatory in this app. Final emulator logcat contained no synthetic vault plaintext. Do not enable full bridge logging to debug real accounts.
- A native defect was caught and fixed: `PluginCall.getLong` rejects JSON integers represented as Java Integer. The revision parser now accepts validated integral Number values within JavaScript's safe range. Native write/rollback/restart evidence below exercises this fix.
- Emulator 1920×1200 tablet layout was visually inspected. A narrow phone viewport showed inherited toolbar crowding; phone interaction/layout acceptance is still open. No unrelated UI redesign was performed.

## Reproducible commands

```sh
npm run build                  # existing browser dist/
npm test -- --workers=2        # 86 tests, synthetic routes/data
npm run android:debug         # native dist-native/, sync, debug APK
npm run android:bundle        # currently unsigned release AAB
```

Artifacts:

- `android/app/build/outputs/apk/debug/app-debug.apk` (development signing, all-provider read preview).
- `android/app/build/outputs/bundle/release/app-release.aab` (unsigned; not ready for upload).

The native build does not overwrite the browser's `dist/`. `android/local.properties`, keys, build outputs, generated bundled assets and `output/` are ignored. No Git commit, release publication, external deployment, paid enrollment or infrastructure was performed.

The headless test emulator was restarted for the authorization continuation; the existing browser/backend services were left running. Restart it for the next proof:

```sh
~/Library/Android/sdk/emulator/emulator -avd Weekaboo_API_36 -no-audio
```

On the disposable `Weekaboo_API_36` emulator only:

```sh
adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 shell am start -n app.weekaboo.calendar/.MainActivity
node scripts/verify-android-foundation.mjs
node scripts/verify-android-http.mjs
```

Foundation proof temporarily disables emulator Wi-Fi/data, relaunches the app, verifies UI/task/vault persistence, restores original task records, removes synthetic vault entries and restores networking. It refuses physical-device serials. It uses Playwright's Android API; generic `connectOverCDP` failed because this WebView doesn't support browser context management. After a cold restart, use a fresh driver for cleanup to avoid stale WebView references. Earlier interrupted cleanup was explicitly repaired and the final run recorded cleanup=true.

HTTP proof uses synthetic XML/conditional headers against Postman Echo; unauthenticated iCloud PROPFIND returns 401; httpbin redirect remains 302; insecure HTTP is rejected. **This does not prove authenticated CalDAV discovery or event CRUD.** No user credentials or real events are involved.

Evidence under `output/standalone-stage1/`:

- `playwright-final.log`: 64 passed; `build.log`: browser build.
- `native-final-build.log`: debug APK and release AAB build.
- `android-foundation.json`: six checks, exact APK hash, cleanup=true.
- `android-http.json`: XML preserved, conditional header preserved, PROPFIND 401, redirect 302, HTTP refused.
- `artifact-checks.json`: no native server URL/API path, logging disabled, no synthetic secret in logcat, unsigned AAB/hash.
- `android-offline.png`: actual emulator tablet UI after offline cold launch; synthetic task later removed.
- `review-candidate.json`, `review.jsonl`, `review-status.json`: independent review of immutable sanitized snapshot. It found the native integer/revision defect; reproduced and fixed. The subsequent integer fix, logging hardening and replacement HTTP plugin are **not independently re-reviewed** within that review's bounded window. No final release approval claimed.

## Next implementation work

1. Implement Google AuthorizationClient and MSAL bridges behind the shared authorization boundary. Native registrations are required below. Do not reuse confidential web client secrets or desktop OAuth on Android.
2. Prove consent/cancel/restart/access reacquisition with disposable accounts and a physical tablet. Add explicit capability/reconnect status to services before enabling buttons.
3. Prove authenticated iCloud CalDAV discovery with the replacement transport and vault. Re-enter the app-specific password on the device; do not migrate backend secrets into the APK.
4. Port provider reads/writes one vertical slice at a time, retaining recurrence/DST, protected Teams body and conditional-write fixtures. Preserve uncertain-write outcomes and implement stable create identities before retries. One engine owns each account's writes.
5. Add versioned task export/import, migration/conflict tests and native queue/cache persistence. Keep UI behavior and old origin data intact.
6. Prepare Xcode/team access during Android work; iOS second, macOS third. Broader architecture and exit gates remain in the canonical plan.

## Native test registration values

These are **public debug-build identifiers**, not credentials. Keep all existing web registrations.

- Package: `app.weekaboo.calendar`.
- Google Android OAuth client SHA-1: `7E:0B:37:27:7E:B4:62:2E:1C:58:B0:E5:A0:F4:93:F1:F7:14:AF:F6`.
- Microsoft Entra Android signature hash: `fgs3J360Yi4cWLDloPST8fcUr/Y=`.
- Microsoft redirect follows Entra's Android configuration output; the signature path is URL encoded where required. Prefer copying the console-generated value into the eventual MSAL config.

Async requests for these registrations, USB debugging and domain ownership are pending. Absence of a reply is not completion. Release builds will need their **release** signing fingerprint registrations; a debug registration does not cover them.

## In-progress continuation: native authorization (11 September)

User explicitly asked to continue independently toward MVP on all platforms and will supply registrations. Registration blocks live consent, not bridge/provider implementation. Do not stop after foundation packaging again.

Work underway (NOT yet verified):
- `src/platform/authorization.ts`: private grant/error/runtime contract; Android adapter in `android-authorization.ts`.
- `WeekabooAuthorizationPlugin.java`: Google AuthorizationClient (Play services auth 22.0.0), explicit account selection, silent reacquisition, interactive-resolution callback, per-operation busy guard, generic errors/no token logging. Public signing/setup metadata from installed certificate. Google identity must still be verified through userinfo in shared provider before persistence.
- `MicrosoftAuthorization.java`: MSAL 8.4.2 multiple accounts, system browser only, common vs organizations/shared scopes, silent reacquisition and account-local cache removal. Registration config is public-only `android/native-auth.properties` (ignored); example committed. Existing public client ID copied locally; no confidential secret copied.
- Build dependency first failed because MSAL's display-mask dependency requires Microsoft's official Duo Maven feed. Added feed restricted to `com.microsoft.device.display`; rebuilding. Compile/live authorization not yet claimed.
- Pending: SDK compile corrections, setup UI, emulator cancellation/config failure proof, shared account identity/discovery slice, scoped independent auth review. Evidence directory `output/standalone-auth/`.

Official sources read: Android authorization guide; Google AuthorizationRequest.Builder now supports SELECT_ACCOUNT (overrides setAccount); MSAL configuration/acquire docs; MSAL current Java source. Versions confirmed against Google Maven and Maven Central metadata. SDK default MSAL refresh-token management is retained; no custom OAuth code exchange and no web-server secret in native apps.

## Latest checkpoint: auth/read review and iCloud port (in progress)

- Shared readers now sit behind `src/engine/connections.ts` provider connections, rather than OAuth-specific branches in the coordinator. `services.ts` handles accounts/cache/settings uniformly; Google/MS connection adapters own SDK identity validation. `src/native-bootstrap.tsx` is the only native composition root.
- iCloud transport and read connection implemented: `providers/caldav.ts` validates every Apple partition redirect before credentials, parses namespace-aware multistatus, discovers principals/home/VEVENT calendars, and REPORTs a range. `providers/ical.ts` uses pinned ICAL.js 2.2.1 (MPL-2.0; library unmodified) for timezone-aware recurrence, exceptions/EXDATE/orphan moved slots. Missing timezone definitions/history fail explicitly. RANGE=THISANDFUTURE remains an explicit unsupported preview case. These are fixture-stage changes; no real iCloud password/consent used on native yet.
- iCloud app-specific password is stored only in the native encrypted vault, separate from SQLite account metadata; prepare/commit rollback restores a prior credential if state persistence fails. No backend credentials copied. iCloud UI button is enabled in source; latest installed APK may predate this source until rebuilt.
- `src/platform/foundation.ts` removed after native services replaced it. No duplicate placeholder engine remains.
- Account setup public identifiers rendered/inspected on emulator (`native-setup.png`); formatting tightened afterward. Native document CAS rejects stale/fractional revisions (`native-documents.json`). App SQLite 1→2 upgrade retained exact task body/revision (`migration.json`).
- The independent auth/read review completed at sanitized HEAD `d005094f75aa4e52c72ec154fd50d435c7e7724f`: no P0; four actionable P1s. Reproduced/fixed: overlapping SDK operations now queue in the TS Android adapter; Google absent `items` means empty (present invalid value still fails); zero-duration Google/Graph events retained without falsifying duration; cache prunes oldest windows below 6M characters before native 8M limit. New regression tests in standalone-engine.spec.ts. Fixes are being tested, not independently re-reviewed yet.
- Review also alleged missing scripts/android.sh / ignored config; these were sanitized snapshot omissions. Real script exists and builds; real .gitignore contains android/native-auth.properties. No secret-config tracking change needed. Future review snapshots must include scripts and .gitignore.
- Main UI now reads account metadata after event refresh, and labels cached events as saved instead of freshly synced. This fixes the account-health race without changing UI layout.
- Regression work ongoing: `review-fixes-tests.log`; initial iCloud fixture found ICAL.js assumes UTC before a VTIMEZONE's first transition. Fixed the fixture to include prior history and added a separate explicit-rejection test for insufficient history, so no silent UTC conversion is accepted.

Continue immediately with targeted test results, current native rebuild and iCloud rollback/transport proof. Update attribution/notices for ICAL.js and MSAL/Google dependencies. Then implement safe native provider write slices/queue and token-revocation recovery; physical consent still pending registrations. iOS full Xcode install remains a user dependency; independent Android coding is not blocked.

## Write pipeline checkpoint (continuing; not enabled in UI yet)

- `src/engine/operations.ts` adds a durable CAS intent journal. Stable UUID-derived remote create IDs survive sent/uncertain outcomes and restarts. Identical unresolved input reuses its intent; uncertain operations cannot be resent blindly. State transitions, preflight persistence failures, base revisions and explicit nulls are fixture-tested in `tests/operation-journal.spec.ts`.
- `src/engine/providers/google-writes.ts` implements single-attempt Google lookup/create/update/delete. Named timezone and UTC UNTIL regressions carried over. Update checks the original ETag and PATCH/DELETE send that same If-Match; no retry with a newly fetched ETag. Create requires a persisted legal base32hex ID. `tests/google-native-writes.spec.ts` covers these paths and 503 ambiguity. Combined `write-foundation-tests.log`: 7 passed.
- These modules are **not wired to the native CalendarService yet**. Do not claim native editing works. Next wire a provider writer contract, opaque target resolution, journal preflight/dispatch/reconciliation, and editing capabilities only for completed providers. Block account removal while unresolved operations exist, preserving/exporting pending work. Microsoft writes must preserve generated Teams HTML; iCloud writes must preserve VTIMEZONE/recurrence/ETag behavior.
- Shared ProviderHttp now supports mutations and distinguishes 409/412 conflict, 404 not-found and mutation 5xx/invalid-success-body uncertainty. Reads retain existing paging safeguards.
- Token-recovery improvement: a rejected identity token (401) triggers exactly one SDK renewal; Google clears only that rejected cached token, MSAL force-refreshes. Wrong-account responses never trigger a retry. `token-recovery-tests.log`: 14 targeted passes; SDK rebuild passes `build-token-recovery.log`. Live revocation/expiry still untested. Calendar-specific authorization failures beyond identity lookup still need coordinated recovery.
- Native HTTP now limits response reads to 16 MiB before converting the body to a JS string. Google/MS/iCloud provider limits remain narrower where needed.

Current APK installed on emulator predates the token-recovery rebuild unless reinstalled; source/build outputs may be newer than running WebView. Existing Mac browser dist remains untouched by native builds. Do not overwrite/install real-device data without preserving it.

## Continuation checkpoint — recurrence review and native writes (11 September)

- Independent iCloud review completed at `874cd72b6b083317b0ee666b9e548846040f4ea8`, exit 0; two confirmed P1s: mixed-zone RECURRENCE-ID duplicated/ghosted overrides, and old recurrence anchors incorrectly required historical offsets outside the query window. Fixed with instant-based slot matching and history checks only around rendered dates. `output/standalone-icloud/review-fixes-tests.log`: 12 passed. Fixes are not a separate independent-review pass.
- Google writes now wired through the optional provider writer contract. Calendar editability reflects actual writer availability; Microsoft/iCloud remain disabled until their writers are connected. Persistent operation journal precedes dispatch. Cache invalidation occurs before confirmation, so a post-save storage failure retains a reconcilable intent. Lost create/update/delete results check the remote result instead of replaying mutations. Changed drafts are blocked while another change in that calendar remains uncertain. Fixture evidence: `write-service-tests.log`, 13 passed including low-level Google and journal tests.
- Connected accounts now exposes saved native changes with Check result / Try saving and explicit discard/stop-tracking confirmation. No automatic uncertain resend. Unsent prepared operations can be discarded or removed safely during disconnect; sent unconfirmed changes block disconnect until resolved/dismissed. Browser adapters do not expose this optional facility.
- Microsoft writer is implemented but not wired yet: original If-Match retained, changed-fields-only PATCH, generated Teams HTML preserved byte-for-byte using parse5 source ranges, queryable stable operation marker plus transactionId for create reconciliation. Six deterministic Microsoft tests pass (`microsoft-write-tests.log`). Need full compile/build, additional body edge fixtures, native coordinator proof, and then registry wiring. Native live OAuth registration still pending.
- parse5 8.0.1 (MIT) added to parse HTML safely with source offsets; notices need updating. `graph-recurrence.ts` ports existing representable repeat patterns and local timezone anchors. Unknown patterns fail rather than silently change recurrence.
- Latest emulator APK still predates these changes. Rebuild/install and synthetic native proof required before claiming native editing works. No real account writes, secret copying, infrastructure, release publishing or charges performed.

Next: finish Microsoft writer integration and validation; iCloud conditional resource writes; native emulator end-to-end CRUD/recovery; iOS shell/adapters can progress before signing while full Xcode remains a user dependency. Keep working rather than stop on registration. All-platform MVP is not complete.

## Continuation checkpoint — Android CRUD proof and Apple foundation

- Full browser/shared regression suite: **109 passed** (`output/standalone-auth/all-tests-writes.log`). Android debug build passes (`build-writes.log`). Microsoft writer now registered alongside Google.
- Installed Android emulator: **Google and Microsoft create/edit/delete passed through the real React UI, shared engine and native SQLite**, with six confirmed durable journal entries and preserved Microsoft meeting HTML. SDK and provider HTTP were synthetic, not live consent or network writes. Evidence: `native-writes.json`, `native-google-writes.png`, `native-microsoft-writes.png`, `native-writes-cleanup.json`. Test data was restored. Harness uses Android screenshots because WebView page.screenshot closed the CDP connection on this emulator; do not confuse that tooling failure with an application crash.
- iOS Capacitor 8.4.3 Xcode project generated. `native/apple` Swift package prepares SQLite CAS documents, per-device Keychain credentials and bounded HTTPS transport; `ios/App/App/WeekabooBridge.swift` registers narrow storage/HTTP adapters. These Apple files are **uncompiled/unverified**. Package/project syntax alone is not an iOS build.
- Local Apple tooling is internally inconsistent: SwiftPM crashes loading llbuild; Swift 6.1.2 defaults to an SDK built for Swift 6.2. A process-local attempt with SDK15.5 then fails on duplicate SwiftBridging module maps. Logs in `output/standalone-ios/`. No global toolchain files/settings modified. Install/launch full Xcode before Apple compilation and tests; already a user dependency.
- JS data bridges renamed from Android-specific classes/file to `src/platform/capacitor.ts` Native* adapters, shared by Android/iOS. Runtime-specific auth/setup lives in native-runtime.ts. Android retains SDK bridges. iOS explicitly disables Google/Microsoft until its SDK auth implementation and validation; it does not silently call Android or a server. iCloud button is available in the iOS source but actual execution is not proved yet.
- `npm run ios:sync` copies shared native assets; `ios:simulator` fails early without full Xcode and otherwise builds unsigned simulator locally. No signing/provisioning/submission performed. Core package can be reused by a future Mac container; no Mac runtime decision or DMG claim yet.

Immediate work: iCloud conditional resource writes and recurrence fidelity; Android rebuild after Native* adapter rename; resolve native write/recovery coverage and readonly capability edge cases. Apple SDK auth follows with full Xcode. Do not label the all-platform MVP complete or stop merely because console registrations are pending.

## Foreground lifecycle continuation (11 September)

`ActivityLifecycle` is an injected platform port. Browser visibility/focus and native OS pause/resume feed the same React refresh path. Tasks and clock refresh on foreground; calendar polling no longer starts while inactive. Android bridge emits activity notifications; iOS source observes UIApplication activity notifications and remains uncompiled. There is no scheduled background worker or promise of continuous background sync.

`output/standalone-recovery/native-lifecycle.json`: installed Android received actual OS pause/resume and rendered a synthetic SQLite task added while away; cleanup=true. `lifecycle-tests.log`: 15 focused tests pass. `all-tests.log`: **128 passed**, including BOM portability, foreground refresh and autumn iCloud occurrence edits. Current installed APK includes lifecycle and BOM updates; a later cleanup-only promise handler change does not alter the proof. Rebuild final artifacts after the occurrence review finishes. Review remains scoped to occurrences, not these lifecycle adapters.

## 11 September continuation — timezone creation and Apple authorization source

- **134 shared/browser tests passed** (`output/standalone-icloud/repeat-full-tests.log`). New iCloud repeat tests cover Sydney spring/autumn, IANA aliases, civil all-day ranges, strict UNTIL, malformed rules/unknown zones, and stable-resource UID reconciliation. Existing occurrence edits and other provider regressions still pass.
- Android debug rebuilt/installed. `output/standalone-auth/native-writes.json` now proves **12 confirmed synthetic operations**, including new iCloud repeat creation through the installed editor with embedded Australia/Sydney VTIMEZONE. Cleanup receipt confirms restored private emulator state. No live user calendar writes or consent claims.
- Timezone bundle: 340 IANA 2026c definitions, aliases/notice from the same release, explicit bounded maintainer download only. Read platform-reference-notes.md for provenance/hash and reviewed differences against older ICU. Fixed root data ignore so shipped `src/engine/data` stays source-visible; private root `/data/` remains ignored.
- New iOS authorization source is now being integrated: GoogleSignIn 10.0.0 and MSAL 2.15.0, SDK callbacks, per-account Google secure archives, MSAL account cache, app-private cache removal, shared TS serialization/error translation. This is **uncompiled source**, not a native sign-in pass. Full Xcode remains required. MSAL's selected current package requires iOS 17; app deployment target now 17. iOS public registration values belong in ignored `ios/native-auth.xcconfig`; tracked example/defaults disable unconfigured providers.
- Google iOS public refresh-if-needed API cannot force-refresh a rejected but unexpired grant; source returns reconnect-required rather than replaying it or using private SDK internals. MSAL supports force refresh. Validate Google multi-account archive/refresh/restart and SDK singleton cache clearing on device before accepting parity.
- Next: complete Apple source/header review and independent auth review, registration preflight, full builds/tests for the adapter extraction, then device consent when inputs arrive. Whole-series iCloud writes, physical Android validation, Apple compilation/signing and macOS container remain incomplete. Do not stamp any platform production-ready.

### Apple independent review result and fixes

Review completed in 407 seconds at clean source `a77738b62c6e652b1d90ac6c2217df4f6bdc7116`; receipt/triage in `output/standalone-ios/auth-review/`. Confirmed failed-OAuth-connection cleanup gap is fixed for identity/discovery/local-commit failure; existing account caches are protected on reconnect. Runtime SDK references stay opaque. Four dedicated fault-injection tests added. Weak-self completion exits now reject; the claimed P1 trigger was not reproduced under normal Capacitor lifetime. Keychain storage failures now report unavailable. Fixes postdate the reviewed snapshot and are not independently approved. Process death before grant delivery and failed cleanup still need native investigation; there is no cross-SDK/SQLite transaction claim.

`createStandaloneApp` is now the sole provider/service assembly for installed runtimes; native-bootstrap only injects concrete ports and renders React. It does not import React/SDK types into the provider engine. Installed Android composition proof still confirms all 12 synthetic writes and cleanup. Native SDK negative/cancel proof also passes after shared auth extraction. Full suite before cleanup delta: 136 passed (`auth-full-tests.log`); rerun after cleanup changes before updating that count.

### Durable resume after desktop checkpoint

No reviewer or signing process remains pending; desktop review timed out with no verdict. Last code changes after the 150-test full run are covered by 10 focused desktop tests plus signed packaged launch/task-save. Browser build and iOS asset sync pass. Source is still entirely untracked in the main repo: never bulk-add private `output/`, `.env`, root data or native registration files. No public release or Apple notarization submitted.

User actions are consolidated in `docs/user-dependencies.md` → “Immediate setup for the implemented native apps”. `npm run native:setup` prints only public fingerprints and configuration/tooling booleans. Google iOS/Mac values remain placeholders; Microsoft public IDs are present but console platform registration and successful native consent are not proved. Full Xcode and a physical Android device are still absent from preflight. Do independent work while these are pending, but do not call all-platform MVP complete or mistake the browser's existing accounts for native setup.

Artifacts/checksums: `output/standalone-desktop/artifact-inventory.json`; Android development APK/unsigned AAB and Developer ID signed, **unnotarized**, arm64 Mac DMG. Normal Mac data lives in its own Weekaboo Application Support profile; all test profiles were disposable. Running browser/backend/LAN preview and Android emulator were preserved. No existing account credentials or tasks were migrated implicitly.

### Android Google registration download imported — 11 September 2026

At Kelly's request, moved the newest downloaded Google OAuth installed-client JSON into ignored `data/oauth/google-android.json`, with owner-only directory/file permissions (0700/0600). Verified exact byte preservation before removing the Downloads original; no credential values logged. Download contains a client ID and Google endpoints, no client secret or redirects, consistent with the requested Android registration. It does not include package/fingerprint fields, so their console values are not independently verified. Android AuthorizationClient uses the installed package/signing identity; this file is a private registration record and is not bundled or injected into the SDK. Successful native consent remains pending.

### Microsoft Android console registration confirmed by supplied configuration — 11 September 2026

Kelly supplied the generated Android MSAL configuration. Its client ID and encoded package/signature callback match existing ignored `android/native-auth.properties`; audience is AzureADandPersonalMicrosoftAccount with common tenant. No local credential changes were needed. This establishes matching console configuration supplied by the user, not successful native consent. Next: authorize a physical Android device, install development APK and test Google/Microsoft connections.

### Physical Android installed and Xcode available — 11 September 2026

Authorized Lenovo TB350FU on Android 14 with Google Play Services. No prior Weekaboo package installed. Verified APK certificate SHA-1 matches registered development identity, installed existing debug APK successfully and launched MainActivity. Physical screenshot `output/physical-android/first-launch.png` confirms shared calendar/task UI renders. No account consent or remote writes performed; Kelly can now use Connected calendars to connect Google/Microsoft. Existing browser data was not migrated.

Full Xcode now installed: 26.6 (17F113); first-launch status succeeds; iOS and Simulator SDK 26.5 available with process-local DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer. This supersedes the missing-Xcode blocker in earlier entries. iOS source has not yet been compiled; next run npm run ios:simulator, fix actual compiler issues, then device signing/registration. No global xcode-select change made.

## Production validation continuation — 11 September 2026

User requests full Android/iOS/macOS preparation and testing, applying Golf.AI runbook lessons. Read vault SDLC, release procedure/playbook and end-to-end proof skill; apply immutable candidate/artifact identity, executed gate counts, real UI plus remote readback, negative tests, cleanup and independent review. Keep evidence here; no vault/Linear/Slack writes or public deployment.

Physical Android Microsoft connection independently read back as active with one calendar and no attention flag. Google first connection failed because native AuthorizationClient returns no accountRef but oauthConnection requires one before userinfo. Android adapter now resolves verified Google email through injected shared provider identity on first selection; existing-account silent renewal retains engine subject checks and 401 retry. Four new tests cover token-only shape, verified identity failure/discovery cleanup, renewal/wrong subject and Microsoft isolation. 24 focused tests pass; full shared/browser suite now **154 passed**. Updated debug APK installed on physical tablet without uninstall/data reset; Kelly asked to retry Google. Actual successful Google consent still pending. Scoped independent review running in output/production-validation/google-auth-review (8 minute cap, own new candidate distinct from earlier timed-out desktop review).

Xcode 26.6 now compiles iOS after explicit Capacitor pluginMethods array types and MSAL allAccounts identity lookup fixes. Simulator build passes; native Apple core XCTest **2 passed** on macOS host (not iOS device proof). Dedicated Weekaboo validation iPhone simulator created and app launches. New XCUITest target exercises installed app; first run ongoing. Evidence in output/production-validation; simulator ID recorded there. Existing web workflows untouched. Remaining user inputs surfaced in conversation: iOS/Desktop Google clients, Microsoft iOS/desktop callbacks, trusted iPhone and Xcode developer team. No production-readiness claim.

### User setup update — shared USB port

Kelly has signed into Xcode. Only one USB port is available; keep the Android tablet attached and finish Android physical validation before asking to connect the iPhone. Physical iOS testing is deferred until the cable swap. Simulator work does not require a USB port. Do not ask for simultaneous device connections or repeat the Xcode sign-in request.

### Simulator and live Android continuation — 11 September

Full Xcode available; user signed in. No additional cable is required for simulators. Added iPad Mini (A17 Pro) and standard iPad (A16), portrait and landscape, alongside iPhone 17 Pro. These simulate form factors, not proof on Kelly/Kerryn's exact iPad hardware or older OS versions. The three-test installed-app suite passed on all three (`ios-matrix.json`, nine test executions). Task creation, process restart persistence, completion and permanent deletion passed. No live accounts in simulators. Safe-area padding and minimum touch input font prevent camera overlap and focus zoom on iPhone. New event label now stays on one line. Screenshot review found XCTest app-only capture cropped landscape; switched to full XCUIScreen capture, repeat visual evidence in progress. A mistaken XCUIDevice screenshot API was caught by compilation and replaced; not a product failure.

Physical Google is active with six calendars; Microsoft active with one (`physical-account-status.json`). Token-only Android grant regression fix is installed. Scoped Claude review completed with no substantive defects reported, but lacked a git-diff tool/file: resulting-source review only, not complete introduced-diff approval. Previous desktop review timeout remains unresolved; do not restamp it.

Live synthetic Microsoft create/readback passed; Outlook later changed changeKey/ETag before editing, and the writer correctly blocked the stale edit. Evidence `physical-live-outlook-conflict.json` records real revision changes and conditional cleanup (GET 404). No guest meetings touched. Testing explicit close/discard/refresh/reopen/reapply flow; do not weaken ETag checks or silently overwrite. One separate attempt hit real network readback failure; fallback cleanup removed its unique test event. Live CRUD not yet a blanket pass.

Android emulator writes/recovery/lifecycle passed. Task export/import and cancel operations passed, including cleanup; its final activity assertion used an older dumpsys label. Updated it to accept modern topResumedActivity while still requiring Weekaboo foreground. Re-running with current APK. Shared/browser suite: 154 passed after CSS changes (`post-layout-regression.log`).

### Refresh and mascot user steering — 11 September

Shared footer now indicates real load progress for manual discovery+event fetching, view changes, lifecycle and polling; retains prior events; suppresses duplicate clicks; honors reduced motion. Three new tests cover delayed initial/manual load, refresh-command/list failure settlement, stale view responses and reduced motion. Full shared/browser suite **157 passed** (`refresh-full-tests.log`). Android APK installed and footer spinner/status visually verified on physical tablet (`physical-refresh.png`). Mac shared build/foundation passes for same slice; iOS simulator suite rerun with native core checks below.

Physical Microsoft now passes real UI create/edit/delete, provider readback, and GET-404 cleanup (`physical-microsoft-live-pass.json`, contains the following Google failure too; inspect per-provider rows). Earlier stale-ETag retry opened the editor before the full multi-account refresh settled. Waiting for the new disabled refresh button to re-enable makes the successful-read boundary explicit. Google-only retry underway; the safety harness rejected Google's empty recurrence array, corrected to allow only an empty rule set. No writes to existing user events.

Kelly reported Android mascot did nothing, then confirmed it now works. Verified actual bundled MP3 playback (HTMLMediaElement play fulfilled, readyState4, advancing playback), logo replay source increment and actual Android input tap. No asset/audio-engine change was required. Kelly then requested removal of tap highlight: shared logo button now sets -webkit-tap-highlight-color:transparent and touch-action:manipulation, preserving keyboard focus-visible. Updated APK installed. No other focus outlines removed. Still need formal mascot/mute/restart parity proofs across Apple/Mac; do not infer full parity from Android's success.

Extended iOS suite links native core into test runner: SQLite persistence/stale-writer checks pass; Keychain test currently fails on initial access (unsigned/ad-hoc runner entitlements under investigation); stricter invalid-transport test also identifies a request not classified as validation. Initial UI tests continue to pass on all three simulator sizes. Do not report full native iOS suite green. Runner now supports --device iphone to isolate core failures without repeating all sizes. Runtime evidence is timestamped under output/production-validation/ios-*.

### Global tap highlight and Apple core follow-through — 11 September

Kelly expanded the tap-highlight request to every control. Shared `src/app-shell.css` now disables the inherited WebKit tap highlight at `:root`, instead of a logo-only override. Selected backgrounds, hover behavior and keyboard `:focus-visible` outlines remain intact. Latest debug APK built and installed with `adb install -r`; physical WebView inspection found all 130 rendered buttons/links/inputs/selects transparent for tap highlight, including the logo, while selected date/Month/Schedule backgrounds remain (`output/production-validation/android-tap-highlight.json`). Browser and future native builds consume the same stylesheet. No new feature or interaction redesign.

Apple core tests now run in a proper app-hosted AppTests target, separate from UI automation. Simulator-only app identity enables actual Keychain testing without changing physical signing configuration. All three core tests pass on iPhone (`ios-20260911T035036Z`): SQLite persistence/stale writes, isolated Keychain behavior and strict invalid transport requests. Full combined suite and both iPad repeats remain pending after this correction. Transport validation exposed Swift CRLF grapheme behavior: string contains checks missed a combined CRLF; UTF-8 CR/LF byte rejection now catches header names/values before networking. Total resource timeout is also bounded. This transport slice still needs independent review; no release claim.

Google-only physical live attempt ended without an observed POST, so live Google CRUD is still unproved; cleanup receipt reports no created event. Microsoft complete live CRUD success remains archived separately. Avoid simultaneous Android automation, installs or user editor interactions during the next bounded live test.

### iOS registrations received — 11 September

Google iOS client plist imported privately, bundle/reversed client scheme verified, ignored xcconfig updated and previous config backed up. Downloads original removed after byte preservation check. Setup checker passes local Google/Microsoft config checks. Microsoft console screenshot confirms Apple callback/common audience. Native iCloud Android connection reported by Kelly, not yet independently validated. iOS authorization/provisioning remains to test; do not ask for Google iOS registration again. Android stays attached for remaining checks before iPad hardware testing. Play signup in progress, not completed/paid/submitted by agent.

### Resume device acceptance after email setup — 11 September

Play Console identity review is pending after user completed enrollment/available checks. Resume existing Android Google live test with serial HVA5FL49, then native iCloud acceptance and outstanding emulator checks. iOS Google registration now configured; sync and full three-device simulator matrix can run independently. No Android app reinstall or competing Android automation while a guarded live test is active.

### Continued device validation and verified Play account — 11 September

Kelly confirms Play Console identity fully verified; do not repeat enrollment instructions. Release signing/package registration/store submission remain separate gates. Updated debug APK installed with data-preserving install on tablet and emulator. Recovery notices now use user-facing Check again/Dismiss and Try again/Discard wording; safety/reconciliation remains intact. Google live create/edit/delete reached provider successfully, but old harness expected HTTP404 after deletion; independent readback proved HTTP200 status=cancelled. Google lookup now treats cancelled records as absent; 15 focused provider/journal tests pass. Latest full iOS simulator matrix ios-20260911T073344Z passed six tests on each of iPhone, Mini and standard iPad; precedes latest recovery-copy/Google-cancelled changes. Pending: rerun guarded Google acceptance, native iCloud CRUD, emulator recovery/transfer/HTTP; full shared suite; independent review; physical iOS consent/signing.

### Current Android Google proof — 11 September

Guarded live Google UI create/edit/delete now passes on updated installed APK, with independent provider readbacks and cancelled-event deletion confirmation. Synthetic cleanup verified (`physical-google-live-pass.json`); earlier failed HTTP404-only receipt is superseded by cancelled-state evidence, not hidden. Full shared/browser suite now **158 passed** (`recovery-google-full-tests.log`). Native iCloud live proof running next. Dedicated release signer created securely outside repository at user's package-registration prompt; public fingerprint supplied, no release signing integration/store upload yet.

### Release setup and follow-up evidence — 11 September

User completed Google Release Android client and Microsoft extra Android signature under the existing registration. Retain development and release entries; the one-key simplification was discussed but not enacted. Downloaded Google release JSON imported privately with verified bytes/ignored status and original removed. Signed local APK/AAB built by `npm run android:release`; private existing signer injected only for release and actual certificate derives Microsoft callback. Public artifact receipt in `android-release-candidate.json`; no physical reinstall or public upload.

Full current iOS suite passes on iPhone, Mini and standard iPad (`ios-20260911T075015Z`, six tests each). Scoped independent Apple transport/Google cancellation review completed in 290 seconds with no findings; its reasoning incorrectly assumes cancelled Google payloads always omit dates, while live proof shows retained details. Do not infer full production approval; retained cancelled resources in ambiguous-create reconciliation need separate follow-through. Release signing changes were outside that reviewed snapshot.

Android updated emulator writes/recovery/lifecycle passed. Task transfer assertions and cleanup passed but the Node process lingered, so orchestration timed out; rerunning only tasks/HTTP with explicit successful process exit after awaited cleanup. Existing physical Google/iCloud live CRUD/cleanup and earlier Microsoft live proof remain recorded.

### Current code/test checkpoint after OAuth downloads — 11 September

Google writer now separates cancelled-resource absence for edits/deletes from retained historical create lookup, preserving pre-fix confirmation of a create that succeeded before deletion elsewhere. Added deterministic GET-only regression and wrong-ID guard; six Google tests and full **159-test** suite pass. Sparse cancelled resources without event dates remain conservatively unresolved for create history (no automatic re-create). Latest signed APK/AAB rebuilt; signature/manifest/receipt refreshed. This final delta is not in the completed review or installed debug device/simulator evidence; retain honest artifact boundaries.

Task-transfer/HTTP follow-ups now both exit zero with cleanup (`android-followup-checks.json`), resolving harness lingering-process timeout without a product change. Independent review returned no findings for earlier scoped Apple transport and Google deletion diff, with the noted incorrect payload assumption corrected by our follow-through. No public release; release native consent and signing/delta independent review still pending.

### Physical tablet transitioned to release signer — 11 September

Kelly explicitly requested the tablet be changed for release sign-in testing. Before replacement, read and validated three tasks through the shared allowlisted backup codec; backed up noncredential display/calendar configuration and checked zero pending event operations. Private owner-only records in `data/device-transition/`, latest pointer `current.json`; verified original APK retained there for recovery. Portable task backup copied to tablet Download/Weekaboo-task-backup.json. No tokens, passwords or vault contents exported.

Replaced debug installation and installed the verified release APK on HVA5FL49. Installed binary SHA256 matches `android-release-candidate.json`; startup works and user already opened Google account chooser. Do not interrupt active consent or reset the device. Accounts need reconnection due signing-key transition. **Three tasks have not yet been restored; next priority after user finishes consent is Settings → Import tasks → Downloads → Weekaboo-task-backup.json → Add tasks.** Confirm three imported records, completion/dates, then restore saved Month/Schedule view, task-width ~27.474%, hour density ~42.94px where applicable. Backups must remain until verified. Local display preferences backed up; accounts not copied. Release candidate receipt marks installed=true, tasksRestored=false. No public upload or production-ready claim.


### Consistent account connection feedback and release task restoration — 11 September

All three providers now use shared Connecting progress, a persistent success card, and recoverable errors. iCloud stays in account setup until discovery and account refresh complete instead of jumping to an apparently empty calendar picker. Password input is disabled in flight and cleared after completion/failure/provider switching. Browser redirect state remains dismissible and recovers after bfcache Back; disconnect clears success and missing-provider refresh cannot falsely confirm connection. Phone-width layout and reduced motion tested.

Full shared/browser suite **167 passed**. Android emulator exercised real WebView → shared iCloud discovery → SQLite/Keystore with synthetic transport and delayed connection, confirming progress/success, no password in account metadata and cleanup. Receipts/screenshots: `output/production-validation/account-feedback/`. Local signed APK/AAB rebuilt and physical HVA5FL49 updated with `adb install -r`, without uninstall or credential loss. Latest installed checksum is in `account-feedback/installed-release.json` and `android-release-candidate.json`. Google, Microsoft and iCloud were visibly present after the user's release reconnects; do not mistake this for rerunning every live CRUD scenario on the new artifact.

**The previously pending three-task restore is complete.** Native release Import tasks added exactly three from the private pre-transition backup; a real native export was pulled back and compared. IDs, ordering and all non-rank fields match exactly, preserving dates/completion history. Receipt: `account-feedback/task-restore.json`. Private recovery files remain in `data/device-transition/`. Current display choices were retained rather than overwriting any choices Kelly made after reconnecting.

Scoped different-lab credential audit completed in 396s with no concrete secret-disclosure/insecure-persistence finding in supplied paths. Confirmed connection UI findings were fixed and tested; final delta was not independently re-reviewed beyond the original time budget. Full threat-model/coverage limits and outstanding cancellation/physical Apple/store gates are in `credential-security-review.md`. No public upload or production-ready claim. iOS shared assets synced; updated iPad Mini simulator follow-up passed (six tests, `ios-20260911T082516Z`). This checks installed-app/core regressions, not live Apple-device consent.

Final packaging check: browser and desktop web-asset builds also pass with this shared UI. Desktop DMG was not repackaged/notarized for this small follow-up. No store upload.

### Final 11 September evening receipts

- Current physical iPad **all three providers pass UI create/edit/delete + direct readback + synthetic cleanup**: `ipad-physical/live/all-current-pass.json`. Installed app version/build now 0.1.0 / 1. Earlier inspector failures remain historical; no unsafe retry or cleanup omission.
- iOS development IPA export succeeded, signature/metadata/private-path/provisioning verified. Development registered-device install only; no public/TestFlight upload. Physical native import/export picker cancellation **1 pass** (`files.xcresult`); normal app relaunched afterwards.
- Android AAB validates under official bundletool 1.18.3, generates signed universal APK; jarsigner passes. Tablet not reconnected/updated yet. Source/build metadata now centrally consistent.
- No additional user action needed while away; next personal inputs are Mac Google Desktop client/real provider sign-in, later Google consent branding/public source/store decisions. Do not send credentials or repeat completed mobile setup requests.

## 11 September 2026 — reconnected Android release checkpoint

Completed native notices/strict runtime locking and scoped independent review; signed APK/AAB validated. Physical same-certificate update preserved all three accounts and all three tasks exactly. Real Wi-Fi-off process restart retained saved content; refresh recovered online. Physical MSAL fallback test passed; production WebView inspection is disabled. See current-validation.md for artifact hash and limits. Continue shared reliability, iOS privacy/distribution and narrow-screen checks, then final Mac refresh. No immediate user setup needed.

## 11 September 2026 — current artifacts

Phone clipping/overlap fixes pass Chromium/WebKit plus all 182 shared tests. Final Android update retains exact task data. iOS current iPhone/Mini/iPad matrix passes 18 tests and current-source App Store distribution export succeeds. Signed Mac DMG exact contents and isolated install/update/task transfer pass. Source/artifact evidence and outstanding release gates are in current-validation.md and release-checklist.md.

## 11 September — privacy package gate and current handoff reconciliation

Documented SDK-aware disclosure evidence; tightened website task/provider privacy copy. Eight website checks and seven privacy-verifier regressions pass. All twelve reviewed privacy manifests match the existing current archive and exported IPA; future exports run the guard automatically. No native runtime change, device reset, credential export or upload. Android remains connected/current; historical status moved out of current-validation.md to preserve a single accurate current ledger.
