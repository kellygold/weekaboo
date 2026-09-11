# Weekaboo release checklist

Updated 11 September 2026. This is the work queue, not a production-readiness claim. Source publication, website deployment and binary distribution have separate gates. Detailed private-device evidence is summarized in [current validation](current-validation.md).

## Public source — authorized destination: kellygold/weekaboo

- [x] Confirm destination/account: Kelly authorized a public repository once clean.
- [x] Check current repository: no remote, no commits; target GitHub repository not present at the initial check.
- [x] Run initial Gitleaks scan of proposed source: zero findings. No history exists yet; this is not a history-scan pass.
- [x] Harden ignores for environment files, credentials, databases, signing exports, device state and local evidence; keep safe setup examples publishable.
- [x] Remove unrelated personal contact/path details from proposed documentation; preserve required upstream license author credits.
- [x] Archive unused motion studies/raster concepts and five denied audio files locally. Retain all thirteen approved greetings.
- [x] Prepare README, MIT code license, contribution guidance, security guidance and asset provenance inventory.
- [x] Separate current handoff from historical checkpoints so old device/setup instructions are not treated as current.
- [x] Kelly confirmed on 11 September that a paid ElevenLabs subscription covered generation on 9 September; model availability and publishing terms checked.
- [x] Fresh source-only npm ci/browser/static build passes; repeatable source audit and four negative/self-tests pass. Repeat final audit with `python3 scripts/audit-public-source.py --gitleaks /path/to/gitleaks` (pinned 8.30.1).
- [x] Initial local commit `4090e70` contains only the audited 413-file manifest. Gitleaks scans of source and all Git refs report zero findings; GitHub noreply author address used. No push yet. Rerun the audit after subsequent changes.
- [ ] Create public `kellygold/weekaboo`, push reviewed source, inspect the public tree and verify README/license/secret-scanning settings. Source publication is authorized; no further confirmation needed once clean.
- [ ] Set and test the actual source URL in `website/site.config.json`; keep absent binary downloads empty.

## Website — local build ready; deployment not yet authorized

- [x] Lead with free, open source and privacy; describe direct provider connections and local storage accurately.
- [x] Explain flexible undated tasks, optional deadlines/time blocks, calendar groups and bidirectional edits.
- [x] Check eight Chromium/WebKit desktop/tablet/phone layouts including 320px, interaction, audio and no external requests.
- [ ] Verify real GitHub link after source publication and rerun site checks against that configuration.
- [ ] Final asset/credits/privacy review, then explicit go-ahead for GitHub Pages/domain deployment.
- [ ] Verify deployed HTTPS/domain/assets. Preserve existing email MX/SPF records.

## Shared behavior and security

- [x] Current shared regression suite: 180 pass, including cancellation race regressions.
- [x] Check native storage/logging boundaries and actual signed-artifact configuration; exact evidence scopes in credential review.
- [x] Retain failed attempts and cleanup evidence; do not replace missing proof with an optimistic status.
- [ ] Complete independent follow-up on the fixed cancellation race in a fresh review session. Existing review budget exhausted without final verdict.
- [ ] Complete live expired/revoked access, reconnect/removal, recurrence/DST scope and ambiguous-write recovery matrix on relevant providers/platforms.
- [ ] Verify final candidate after any packaging/source changes, including assets/notices and fresh-install/in-place-upgrade paths.

## Android

- [x] Developer identity/package-key setup and native OAuth registrations completed by user.
- [x] Prior physical signed build: Google/Microsoft/iCloud connected and basic live CRUD validated.
- [x] Current release emulator: cold launch, task persistence, AAB-derived in-place upgrade, completion/history/delete and settings.
- [ ] Package full native SDK notices. Collector now records 92 resolved components, preserves 30 original files and passes five tests plus debug APK byte checks. 78 unresolved components still block release/bundle; old signed artifacts remain unchanged.
- [ ] Validate exact final release on normal-user-OS physical tablet, including inspection disabled, upgrade and provider reconnect/refresh. Do not uninstall or replace signing key.
- [ ] Review Play App Signing certificate and matching OAuth entries, track/testers, privacy/data-safety disclosures, listing and store assets before upload.
- [ ] Verify sideload/family-install instructions using the final signed APK and checksums; store testing/production approval remains separate.

## iOS / iPadOS

- [x] Native Google/Microsoft registration and initial all-provider iPad consent completed.
- [x] Physical Mini: live CRUD/readback/cleanup; Release task lifecycle, real Wi-Fi-off restart/cache/recovery, isolated Keychain/SQLite/network checks.
- [x] iPhone, Mini and standard iPad simulator core/UI matrix; latest standard iPad feedback build six pass.
- [x] Development archive/IPA refreshed for connection feedback; signatures/configuration and 85 renderer files verified.
- [x] Add deterministic Swift-package acknowledgment collector; five tests pass, 13 original notices across ten locked packages match simulator app exactly.
- [x] Refresh signed archive/IPA for newest notices and source asset cleanup; exact notices/assets and signatures verified in `ios-source-cleanup-current/`.
- [ ] Physical iPhone/larger iPad/minimum-supported-OS and lock/unlock/expiry acceptance. The old iPad is sold: no further work on that device.
- [ ] Configure appropriate family/TestFlight/App Store distribution. Current development profile includes only one formerly connected iPad.
- [ ] Review store metadata, privacy manifest/disclosures, review-account instructions and final archive/export before explicit upload approval.

## macOS

- [x] Signed Apple Silicon app/DMG, isolated native storage/IPC/network proof, installation/replacement/task persistence/export/import.
- [x] User completed Google/Microsoft/iCloud sign-in; all accounts/calendars active.
- [x] Each provider: UI create, notes/location edit, direct readback, delete and confirmed cleanup. No attendees or real-event changes.
- [x] Accounts retained across full app restarts; tasks and calendar settings unchanged.
- [x] Injected native provider outage retains 19 cached labels through renderer reload and failed refresh; recovery without interactive consent. This is not a physical network-off test.
- [x] Signed packaged Google/Microsoft cancellation/retry. True token expiry is not established by ordinary silent acquisition.
- [ ] Refresh final signed app/DMG after asset/license changes; preserve previous artifact-specific receipts.
- [ ] Minimum macOS/Intel acceptance or explicit Apple Silicon-only support statement.
- [ ] Notarization/stapling, downloaded-quarantine/Gatekeeper acceptance, checksum and release identity checks before public distribution.

## User-dependent items — ask directly when needed

- **Resolved:** Kelly confirmed paid ElevenLabs coverage for the audio generation date; no further account/billing evidence requested.
- **Later:** Google OAuth consent still presents Instapie; approve deliberate project/branding separation without breaking that app.
- **Distribution:** chosen Play/tester and TestFlight/family installation routes; any new signing/profile/store action requiring account interaction.
- **Publication:** source repository is already authorized when clean. Website deployment and native binary/store publication still need their own concrete approval.

No new Android/iOS OAuth client, developer signup, device trust or initial provider sign-in is needed merely to continue the remaining independent checks. Cross-device task sync and paid hosting remain deferred.
