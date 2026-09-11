# Weekaboo implementation handoff

Updated 11 September 2026 after physical Android validation, current iOS distribution export, Mac refresh and privacy packaging review. Read [current validation](current-validation.md), [release checklist](release-checklist.md), then [execution plan](release-execution-plan.md). Earlier chronological records are in [implementation history](history/implementation-checkpoints-through-2026-09-11.md) and [validation history](history/validation-checkpoints-through-2026-09-11.md); their old pending statuses are superseded.

## Active objective and authorization

Continue autonomously toward release: Android tablet first, iOS/iPadOS second, Mac third. Preserve browser behavior and shared architecture. Phone redesign is deferred except actual clipping or unreachable controls. No immediate user setup is needed. Continue independent work around unavailable devices and store dependencies instead of stopping at a status report.

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
- Normal Mac profile has all three providers connected. No new registration, credential import or re-consent is needed for ordinary checks. Current package tests use isolated profiles.
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
5. Present Google consent branding decision (currently Instapie) only with a prepared plan that protects that app. No new signup or client registration merely to continue testing.

Keep source/history audits current before authorized pushes. Raw evidence, keys, account labels and recovery files stay in ignored output or protected native storage. Do not write Obsidian/Linear/Slack automatically. Distinguish built, tested, approved, uploaded and publicly available states.
