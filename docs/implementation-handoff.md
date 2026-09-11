# Weekaboo implementation handoff

## Google migration and discovery fix — 12 September 2026

All five new Google clients are received. Active Web, iOS and Mac private configuration and canonical Android registration files now use `weekaboo-app` (project number `124770503970`). Owner-only private backups and receipts are under `output/google-project-migration/active-cutover/`. Browser backend restarted and health200 verified. Microsoft/iCloud configuration and signing keys are preserved.

**Test-user setup completed:** Kelly added the intended accounts and completed fresh Android, Mac, browser and iOS simulator Google consent on 12 September. New-project Android audience/identity/calendar discovery, Mac consent and Google UI create/edit/delete/readback/cleanup/restart, and browser callback/identity/discovery, actual refresh grant and UI CRUD/readback/cleanup now pass. Existing accounts and calendar settings were retained; Android’s three tasks are unchanged. iOS simulator has one active Google account, three calendars and 24 fetched events; restart preserved the account, calendar settings and events. All new clients are configured; no additional client registration is needed for this direct-release test. See [migration evidence](google-project-migration.md#fresh-consent-after-test-user-setup--12-september).

**Runtime candidate `d3bcf4b`:** shared manual discovery now continues after an account fails, preserves failed-account calendars/settings, and retains its warning until discovery recovers. Three regression cases cover partial/all failure and warning persistence. Full safe suite182/182, TypeScript, exact-commit engine22/22 pass. Scoped independent Claude review completed in180seconds with no blocking findings; this is not whole-release approval.

- Android: new signed APK/AAB verified; APK installed in place on the tablet. Exact three-task backup comparison, all account sections/calendar selections retained, release inspection disabled. `output/google-project-migration/android-discovery-fix/`.
- iOS: new signed App Store IPA exported and verified;18/18 fresh iPhone/Mini/standard-iPad simulator tests pass. Retained consent simulator updated in place without data loss: `F18043A2-D6F3-4A75-9BFA-7BF07FBF5330`. Fresh new-client simulator consent and discovery now pass; physical/store execution remains unproved. `output/google-project-migration/ios-discovery-fix/receipt.json`.
- Mac: signed app/DMG rebuilt, package/mount/resource checks pass. Current Microsoft/iCloud UI create/edit/delete, provider readback, cleanup, restart, task and calendar-setting retention pass. `output/google-project-migration/mac/unchanged-providers-1789164513260/receipt.json`. Google fresh consent and live CRUD also pass; Mac is not notarized.

No binary/store upload or site deployment occurred. Follow [Google migration](google-project-migration.md) for detailed evidence, prior failures and remaining consent work. Next: complete remaining platform-specific CRUD/expiry boundaries and distribution preparation. Keep direct-APK evidence separate from Play-installed signing acceptance.

Updated 11 September 2026 after physical Android validation, current iOS distribution export, Mac refresh and privacy packaging review. Read [current validation](current-validation.md), [release checklist](release-checklist.md), then [execution plan](release-execution-plan.md). Earlier chronological records are in [implementation history](history/implementation-checkpoints-through-2026-09-11.md) and [validation history](history/validation-checkpoints-through-2026-09-11.md); their old pending statuses are superseded.

## Active objective and authorization

Continue autonomously toward release: Android tablet first, iOS/iPadOS second, Mac third. Preserve browser behavior and shared architecture. Phone redesign is deferred except actual clipping or unreachable controls. Google test-user setup and fresh consent on Android, Mac, browser and iOS simulator are complete. Continue remaining write/lifecycle and independent release checks. Continue independent work around unavailable devices and store dependencies instead of stopping at a status report.

Public source https://github.com/kellygold/weekaboo exists and audited source pushes are authorized. Secret scanning and push protection are enabled. Native binary/store publication, website deployment, notarization and new charges need their own concrete final approval. Do not infer those permissions from source publication. Prepare all reviewable work first.

## Completed current slice

- Runtime candidate source `d824b4d`: 182 shared tests pass; Chromium/WebKit phone controls corrected and checked. No broad phone redesign.
- Android current signed APK installed in place on the reconnected Lenovo tablet. Exact original tasks retained, all provider accounts preserved, installed bytes matched and release WebView inspection disabled. Immediately preceding packaging build passed real offline restart/recovery and actual MSAL fallback instrumentation. Native inventory: 91 records, 153 notices, zero unresolved. Ten collector tests and bundletool/signature checks pass. Scoped independent Android packaging review passed; whole-product review remains open.
- iPhone, Mini and standard iPad simulators each pass six current core/UI tests on 26.5. Current App Store distribution IPA exports and verifies with existing Apple signing, debugging disabled and no development device restriction. `scripts/ios-release.py` / [iOS release guide](ios-release.md) make this repeatable. No upload performed; old one-device development IPA is superseded.
- Current signed Apple Silicon app/DMG refreshed. Exact renderer/package resources and isolated installation/replacement/task export/import proof pass. Not notarized. Previous real Mac provider consent/CRUD/readback/recovery evidence remains tied to its earlier build.
- Privacy audit found no concrete missing app-owned required-reason declaration in its bounded scan. Twelve SDK manifests retained and verified in current archive and exported IPA. New `scripts/verify-ios-privacy.py` checks reviewed semantic declarations and locked SDK revisions; seven regression tests pass. Export script now runs it. This packaging check does not approve privacy labels. See [disclosure evidence](privacy-disclosures.md).
- Website privacy copy now distinguishes local tasks from provider calendars and authentication diagnostics. Eight Chromium/WebKit viewport checks pass; site remains local. GitHub links are real. Approved thirteen greetings retained; Kelly confirmed paid ElevenLabs coverage, so that asset hold is resolved.

Exact hashes, evidence paths, failed-attempt boundaries and remaining gates are in current-validation.md. Later policy/docs/verifier changes do not alter native runtime artifacts. Rebuild only when runtime/package changes warrant it, and retain each candidate receipt.

## Device and data boundaries

- Android tablet is connected by USB and authorized. Preserve accounts/tasks, use same-certificate in-place updates, never uninstall/reset. Only explicitly disposable Weekaboo emulators/simulators may be reset. Keep credentials in native stores; task export is the allowed portable backup mechanism.
- The physical iPad was sold. Never reconnect, control or clean it. All synthetic remote events/tasks were removed; Kelly waived remaining local backup-file cleanup before factory reset. Continue iOS with simulators or a future approved family device.
- Normal Mac profile has all three providers connected. The Google client has changed and needs normal re-consent; preserve the existing account identity and tasks. Microsoft/iCloud registration is unchanged. Package smoke tests use isolated profiles.
- Live writes must be uniquely named, attendee-free synthetic records with direct readback and verified cleanup. Never alter existing calendar events to test recurrence or expiration. Preserve normal processes/settings on exit.
- Tasks remain device-local. Same calendar accounts do not synchronize tasks. Preserve IDs/completion history during export/import; never copy credential vaults between devices.

## Architecture and durable references

Shared React UI, TypeScript domain/provider engine, narrow authorization/storage/network/file adapters. Android and iOS use Capacitor; Mac uses Electron. No required Weekaboo login, hosted server, tunnel or home computer. Optional browser backend remains loopback-only Python and is not in native packages. Avoid permanent duplicate provider engines. No MCP, hosted sync or infrastructure expansion during this release.

Read [cross-platform plan](cross-platform-plan.md), [platform references](platform-reference-notes.md), [user dependencies](user-dependencies.md), [credential review](credential-security-review.md), [attribution](attribution.md) and [OAuth setup](oauth-setup.md) when needed. Native identifiers are public; user credentials are private. Future MCP/AI-client integration is pinned in [MCP plan](mcp-extension-plan.md), not active work.

## Next independent work

1. Complete SDK-aware Android/iOS store disclosure drafts and accessible bundled acknowledgments. Keep website privacy claims exact; no blanket “Data Not Collected” based only on no backend.
2. Continue isolated provider expiry/reconnect/recurrence/DST/uncertain-write proof. Working user accounts must not be revoked for a test. Cancellation review follow-up is still incomplete: the original eight-minute review budget was exhausted; do not silently retry in that same session.
3. Prepare Play signing/testers/store assets and App Store Connect/TestFlight metadata, without uploading. Preserve existing OAuth registrations. Physical family iOS/minimum-OS acceptance remains a separate checkpoint.
4. Prepare Mac notarization/download acceptance and website deployment as concrete final actions for approval. Explicit Apple Silicon-only scope until Intel/minimum-OS evidence exists. Preserve ImprovMX DNS records.
5. Finish the dedicated Google project migration and fresh authorization on every platform with test-user setup now complete. Keep Instapie registrations and branding untouched. No further client registration is needed except a differing Play app-signing certificate if applicable.

Keep source/history audits current before authorized pushes. Raw evidence, keys, account labels and recovery files stay in ignored output or protected native storage. Do not write Obsidian/Linear/Slack automatically. Distinguish built, tested, approved, uploaded and publicly available states.
