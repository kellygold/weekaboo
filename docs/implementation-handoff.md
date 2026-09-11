# Weekaboo implementation handoff

Updated 11 September 2026, 21:00 AEST. Read this file, then [current validation](current-validation.md) and [release checklist](release-checklist.md). Older chronological entries are preserved in [implementation history](history/implementation-checkpoints-through-2026-09-11.md); they are not current instructions or status.

## Deferred extension

Kelly requested a future MCP/AI-client adapter after this release. See [MCP extension plan](mcp-extension-plan.md); do not implement it now. [OAuth setup](oauth-setup.md) explains official builds versus custom client registrations and public-client versus private-token boundaries.

## Active work

Public source repository **https://github.com/kellygold/weekaboo** is now created and the reviewed source is pushed. Do not confuse this with permission to publish binaries, submit to stores, deploy the website, notarize or incur charges. Initial local commit `4090e70` now contains the audited 413-file source set; source and all-ref history scans pass with zero findings. Origin now points to that public repository. GitHub secret scanning and push protection are enabled; source/history scans passed before push.

Website prominently says free and open source. README, MIT license, contributing/security guidance and source audit are being prepared. Website source URL now targets the actual public repository; eight browser/layout checks pass with GitHub destination assertions. A repeatable Gitleaks audit checks the candidate tree and all refs when commits exist; raw reports/private screenshots remain in ignored output. Kelly explicitly confirmed paid ElevenLabs coverage for the generation date; the audio publication hold is resolved. See the release checklist for every remaining gate.

## Completed latest validation

- Mac Google/Microsoft/iCloud user sign-in plus independent UI create/edit/delete with provider readback and fixture cleanup. Accounts survive full app restarts; original tasks and calendar settings unchanged.
- Mac injected provider outage retains cached event labels after renderer reload and failed refresh; recovery requires no new consent. Physical network outage and true expired-token renewal are not proved.
- Shared suite: 180 passed; signed Mac cancel/retry and Android emulator restart/in-place upgrade/task lifecycle pass. Earlier full iPhone/Mini/standard iPad simulator matrix: 18 pass; latest standard iPad feedback build: six pass.
- Current iOS connection-feedback archive/IPA refreshed at `output/production-validation/ios-source-cleanup-current/` with latest assets and native notices. Development profile allows only one registered device; not TestFlight/family distribution.
- New iOS native notice collector: five tests pass, 13 exact notices across ten locked packages, all 15 resources verified in simulator app. Signed iOS archive/IPA now includes those notices. Android collector preserves 30 texts from 92 resolved components and debug artifact matches; 78 unresolved components block release/bundle builds.
- Website free/open-source copy: eight Chromium/WebKit/layout checks pass at local port 5190. Subsequent source asset cleanup removes unused concepts/denied sounds from future builds; Android/Mac signed artifacts predate cleanup; latest iOS archive/IPA includes it.

Exact receipts, artifacts and boundaries are in current-validation.md. The independent cancellation delta review timed out within its original budget; do not claim an independent final pass or retry it again in that work session.

## Device and data boundaries

- Physical iPad is disconnected for factory reset/sale. **Do not reconnect, control or clean it.** Remote synthetic events/tasks were removed; the user waived remaining local backup-file cleanup.
- Physical Android currently disconnected. Only disposable Weekaboo validation simulators/emulators may be reset.
- All Mac providers connected in the normal profile. No new registration, credential import or re-consent is needed for ordinary tests. Keep secrets inside native stores.
- Tasks are device-local; preserve IDs/history, use export/import, and never copy native credential vaults between devices. No automatic task sync.
- Use synthetic attendee-free unique records for explicitly authorized live writes, verify direct readback and cleanup. Preserve app settings and normal process on exit.

## Architecture / product constraints

Shared React UI, TypeScript domain/provider engine, narrow native auth/storage/network/file adapters. Android and iOS use Capacitor; macOS uses Electron. No required Weekaboo login, hosted server, tunnel or home computer. Browser retains a loopback-only Python backend; it is not bundled in native apps. Avoid permanent duplicate provider engines. Do not redesign the established calendar/task UI during release preparation.

Priorities: Android, iOS/iPadOS, then signed/notarized macOS DMG. Static public website/download/source links; operating cost target is the domain only. Existing signing material is available locally; never regenerate or replace it implicitly.

For rationale and researched provider differences read [cross-platform plan](cross-platform-plan.md), [platform references](platform-reference-notes.md), [user dependencies](user-dependencies.md), [credential review](credential-security-review.md) and [attribution](attribution.md). Registration/sign-in prerequisites are already complete; user-facing future questions belong directly in conversation, not only in a Markdown file.

## Continue independently

Public repository creation, source/history audit and website source-link validation are complete. Keep source changes audited before push. Complete Android native acknowledgments and refresh signed artifacts without changing profiles. Preserve honest release gates for independent review, remaining device/expiry/recurrence tests, consent branding, store tracks and notarization. Keep this handoff and checklist updated rather than accumulating contradictory top-level instructions.
