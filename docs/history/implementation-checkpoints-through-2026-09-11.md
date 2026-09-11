# Historical implementation checkpoints

Archived 11 September 2026. All device/setup instructions below are historical. Use ../implementation-handoff.md for current work.

# Standalone implementation handoff

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


Updated 11 September 2026. Repository-local engineering handoff; not a public release claim. Implementation has started. Read [current progress, evidence and next work](../standalone-progress.md) before the original baseline map below.

Latest account-feedback/security/task-restore checkpoint is in `standalone-progress.md`; the tablet now runs the release signer, all three accounts have been reconnected, and the three-task backup has been restored and export-verified. Read `credential-security-review.md` for the bounded audit and remaining gates.

Latest website / physical iPad continuation: read the first checkpoint in `standalone-progress.md`. Physical iPad is installed, trusted, Developer Mode/Web Inspector enabled and all three accounts connected. Read the newest checkpoint; guarded live provider tests and revised website validation are in progress. Public links/publication remain pending.

## Resume here

1. Read [canonical architecture and stages](../cross-platform-plan.md).
2. Use [researched platform notes](../platform-reference-notes.md) for callbacks, primary sources and costs.
3. Shared service seams and three-provider engine are implemented. **167 shared/browser tests pass. Physical Android Google, Microsoft and iCloud accounts are connected; all three have basic live create/edit/delete evidence at the artifacts in the validation ledger. Play identity and release package/key registration are user-confirmed complete. Full Xcode is installed and signed in; iOS compiles, and initial installed-app tests pass on iPhone, iPad Mini and standard iPad simulators.** Read current progress and `production-validation.md` for exact coverage, live Outlook conflict findings, cleanup and remaining gates. Continue verification/fixes; do not restart extraction or ask for already-completed Android/Xcode setup.
4. Read [user dependencies](../user-dependencies.md), then finish Android live provider/physical testing. Keep iPhone and both iPad simulator sizes in the matrix. Delivery order is Android, iOS, then macOS DMG; do not block mobile on desktop packaging. Preserve the browser workflow and track production parity gaps explicitly.

Do not start by deploying an authenticated backend, implementing household tenancy, adding paid services, or switching to device system calendars. The accepted direction is standalone direct-provider apps and an optional future service. No mandatory Weekaboo login, no required public callback backend, no home server. The website is static project/download documentation. Budget is domain-only operating cost; store/distribution fees are unresolved, not implicitly approved.

## Original source starting point (superseded where noted in progress)

| Files | Current responsibility / seam |
|---|---|
| `src/main.tsx` | Root composition and feature orchestration; constructs IndexedDBTaskRepository and calls backend commands directly |
| `src/domain.ts` | Calendar/CalendarEvent/Task shapes; CalendarProvider currently reads only; task repository contract; some date helpers |
| `src/calendar-api.ts` | `/api` HTTP helper, backend DTO mapping and read provider; numeric backend source IDs leak into client identities |
| `src/calendar-providers.ts` | Provider labels, not an integration engine; `local` means sample data, not an invitation to restore Mantel Family calendars |
| `src/AccountSetup.tsx`, `src/CalendarControls.tsx` | Account setup and calendar visibility/group/configuration; extract AccountService/CalendarService usage |
| `src/EventComposer.tsx`, `src/EventTimeChange.tsx` | Editor and gesture mutation paths; must use shared commands |
| `src/repository.ts`, `src/task-scheduling.ts` | Browser tasks and task scheduling; preserve IDs, history and rank |
| `src/id.ts` | Cryptographic UUID fallback for insecure LAN contexts; do not regress task creation on HTTP preview |
| `src/EditorSurface.tsx`, `src/DetailContent.tsx`, `src/RichNotesEditor.tsx` | Shared surfaces, event details and in-app rich notes; retain design behavior |
| `backend/weekaboo/integrations/providers/` | Python Google, Microsoft and iCloud behavior to port; base and registry contracts |
| `backend/weekaboo/integrations/{google_api,microsoft_api,caldav_client}.py` | Provider HTTP behavior and discovery |
| `backend/weekaboo/integrations/{sync_engine,pushqueue,recurrence,event_mapping}.py` | Sync, write queue, timezone-sensitive recurrence and IDs |
| `backend/weekaboo/integrations/microsoft_body.py` | Safe preservation/editing of generated meeting content |
| `backend/weekaboo/integrations/windows_zones.json` | Attributed CLDR Windows/IANA mapping |
| `backend/weekaboo/api/events.py`, `schemas.py`, `models.py`, `storage.py` | Event write semantics, validation and four-table SQLite baseline |
| `backend/tests/test_provider_regressions.py` | Corrected DST, timezone and conditional-write cases; preserve in port |
| `backend/tests/test_icloud_push.py`, `fake_google.py` | Conflict/retry behavior and fake support |
| `tests/`, `playwright.config.ts` | Existing browser regression suite |
| `docs/attribution.md`, `licenses/` | Mantel MIT, fonts, Tiptap, CLDR and mascot provenance |

Proposed package names in the canonical plan are not directories that already exist. No selected desktop runtime, native vault/database plugin, native client ID or release package identity yet. `app.weekaboo.calendar` is a provisional identifier suggestion only. Local signing/toolchain findings and pending user questions are recorded in user-dependencies.md. Do not conflate a UI wrapper with an on-device provider engine.

## Existing verification worth preserving

The 10 September provider fixes passed **224 backend tests** and **57 live assertions** across Google, iCloud and Microsoft, plus a frontend build. All uniquely identified synthetic events were removed remotely and locally. The corrected cases were:

- Google timed recurring events include a named timezone and correct UTC UNTIL.
- iCloud recurrence retains local wall time across DST with TZID/VTIMEZONE and zoned expansion.
- Google conditional writes reject stale edits.
- iCloud rejects a stale write rather than retrying the old body with a newly read ETag.

See local fix report (private local evidence: `output/provider-fixes/report.md`), verification (private local evidence: `output/provider-fixes/verification.json`) and live results (private local evidence: `output/provider-fixes/live.json`). Historical audit limitations (private local evidence: `output/provider-matrix/limitations.md`) describes the pre-fix state; its four corrected defects are superseded by the fix report. Its other provider limitations remain relevant. Evidence files/screenshots can contain personal identifiers: retain locally and sanitize before public publication.

The different-lab review timed out after 420 seconds without a verdict. Existing checks are not an independent-review pass or release approval. The reviewed backend snapshot existed only in an isolated temporary repository, not as a commit in this application repository. Current source inventory was entirely untracked at documentation time; do not reset or bulk-commit everything, especially `output/`.

Known unresolved behavior:

- Simulated lost successful create response duplicates Google and iCloud events. Microsoft emits stable transactionId, but fake-server deduplication is not live proof. Local reproduction: `output/provider-matrix/ambiguous-create.py`.
- Recurrence editing scope differs: Google/MS imported instances versus iCloud masters/detached overrides; no general this-and-following capability.
- Microsoft richer recurrence patterns, arbitrary shared mailboxes, attendee writes/RSVP, new conference creation and event moves are not full-parity features.
- Existing reconciliation is record-level timestamp-based, not field merge.
- Fresh native consent, revoked/expired access, native storage, offline native launch and installation/update have not been tested.
- User reports physical-tablet iCloud description/end-time changes worked bidirectionally through the current Mac-backed app. Do not dismiss that evidence; it is not proof of standalone native access.

## Local running environment (check before assuming still alive)

- Vite: `http://127.0.0.1:5188`.
- Python backend: `http://127.0.0.1:8080`, loopback-only and single-user.
- Temporary LAN preview: last known `http://192.168.1.76:5189`; static `dist/` plus local API proxy in `output/tablet-preview/serve.mjs`. IP may change. It is a test harness, not deployment architecture.
- LAN preview requires a fresh build for changed frontend assets. User resolved the initial slow load by reconnecting tablet Wi-Fi; do not re-open that diagnosis without new evidence.
- Google/MS current web OAuth still uses localhost; fresh connection from the tablet fails. Existing cached/connected calendars are usable through the proxy.
- Tasks are isolated by browser/origin IndexedDB. Mac localhost and tablet LAN origins have separate data. Empty tablet tasks were expected, not provider sync failure.
- No ngrok/public API deployment, PWA/service worker or native app build is established.

Credentials live in ignored `backend/.env` and encrypted `data/weekaboo.db`. Do not print, copy into docs, export with tasks, or search unrelated accounts for them. Preserve the key with private backups; do not replace it or migrate existing credentials implicitly. Reconnect on new native installations.

## Commands and validation scope

From repository root:

```sh
npm run build
npm test
uv run --directory backend pytest -q --disable-warnings
```

`npm test` is Playwright. Read the configuration before running against live accounts. Ordinary deterministic tests should use fixtures. Provider live probes must create their own clearly named disposable records, avoid attendees, and verify cleanup. Run existing suites at relevant migration boundaries; do not re-run the entire live matrix for documentation-only edits.

Runtime startup is documented in README. Preserve working local services during the architecture extraction unless a necessary restart is identified. Ports are development details and must not become installed-app constants.

## Preserve current product choices

- Weekaboo name and selected calendar mascot; replay animation on click, randomized approved local audio with mute/reduced-motion behavior preserved.
- Day, 4-day, Week, Month and Schedule views; month-heading date picker and Today navigation.
- Per-calendar color and account/subcalendar controls; Connected calendars owns connections; cog owns appearance.
- Compact viewport-fitting shell, internal scrolling, draggable vertical task divider and adaptive phone presentation.
- Anchored animated event/task surfaces; click outside with unsaved-change handling; in-app editing, meeting links and attendee status grouping.
- Undated backlog plus focus date/deadline/optional time block; completed tasks retained on completion day; Today includes completed items and Done covers seven days.
- Three unfinished Anytime items prioritized with inline expansion; scheduled blocks remain timed separately.
- True event timing with readable short labels, overlap-local widths, pinch density bounds; hold-to-adjust rather than handles obscuring ordinary clicks.

Do not turn the migration into another UI redesign. The user requested well-organized reusable implementation, not a fork of Mantel or a hosted SaaS rebuild.

## Original documentation stop point (historical)

The architecture, reference notes and this handoff are written. No native code, provider console settings, data migration, deployment, publication, purchase or task sync was performed. On the next implementation instruction, begin with the Stage 0/1 work above and keep the plan's stage status/evidence current.

## Latest resume pointer (11 September evening)

Start with `docs/current-validation.md` and the top of `standalone-progress.md`. Physical iPad is connected/trusted, all three accounts work, final current-artifact live CRUD passed with all synthetic events removed. User is away for food and requested continued work. Site review edits are implemented locally, preview port 5190; no publication. Version/build now come from package.json (0.1.0 / 1). Full shared 167 and iOS simulator 18 pass; physical task/orientation and native parity checks pass; Mac installation lifecycle passes; Android AAB validates/generates signed APK. iOS local development IPA export and physical file-picker cancellation checks are the latest in-progress steps. No need to redo provider registration or device setup. Remaining user dependencies are Mac client/consent, later branding and distribution steps, plus public source/download URLs.
