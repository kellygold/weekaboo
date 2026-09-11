# Release execution plan

Accepted direction: 11 September 2026. Kelly asked to pursue the remaining work autonomously, with Android tablet delivery first. No new setup is needed to continue engineering. This plan sequences the [release checklist](release-checklist.md); [current validation](current-validation.md) remains the evidence ledger.

## Delivery sequence

1. **Android tablet candidate.** Complete exact-version native dependency acknowledgments and lock resolution. Build signed APK/AAB with the existing key. Verify packaged assets, notices, version, callback identity and non-debuggable settings; validate AAB with bundletool. Exercise emulator install/upgrade, task persistence, offline/recovery, connection feedback and tablet interactions. Preserve all existing data. Prepare the actual APK, checksum and installation instructions for Kelly/Kerryn. Final physical-tablet acceptance remains distinct from emulator evidence.
2. **Shared reliability.** Complete bounded negative tests for cancellation/timeouts, revoked/expired authorization, concurrent writes, uncertain saves and recurrence/DST scopes. Use isolated fixtures; live validation may only create uniquely named, attendee-free synthetic events and must verify cleanup. Do not revoke Kelly's working accounts merely to simulate an error. Fix confirmed defects, then run the relevant regression gates. Obtain a fresh independent review of the final candidate; a timeout is not approval.
3. **iOS/iPadOS candidate.** Reuse the completed physical iPad evidence without claiming it covers later artifacts. Verify current simulator builds on iPhone, Mini and standard iPad, including small-screen usability, safe areas, keyboard, editors and tasks. Prepare distribution export/TestFlight metadata with existing Apple membership and credentials. Check privacy manifests, signatures, bundled assets/notices and distribution profile eligibility. Never reconnect or control the sold iPad. Physical iPhone/Kerryn-device acceptance is a later explicit checkpoint.
4. **Mac candidate.** Refresh the signed Apple Silicon app/DMG with final assets/notices. Verify install/replacement, persistence, provider recovery and signatures against that artifact. Prepare notarization/stapling and downloaded-quarantine checks, preserving the existing profile. State Apple Silicon support explicitly until Intel/minimum-OS acceptance is proved.
5. **Distribution preparation.** Finish store descriptions, privacy/data-safety drafts, reviewer instructions, screenshots, versioning, checksums and platform-specific installation instructions. Resolve actual Play App Signing versus direct APK certificate mapping before a Play-delivered build is called tested. Prepare an exact upload/deployment manifest for final approval; do not publish placeholder downloads.
6. **Website and source.** Keep website claims aligned with the verified product, and retain the live GitHub source link. Prepare GitHub Pages deployment, preserving domain email records. Add actual download destinations when corresponding artifacts are approved and available. Audit source/history before pushing changes. Website deployment and app publication are final reviewable actions, not blockers to preparing the work.

## Phone layout scope

Tablet delivery is the first milestone. A broader phone redesign is deferred. Before iPhone release, verify that navigation, task access, event viewing/editing, keyboard use and account setup remain usable on a narrow screen. Clipped controls, unreachable actions or lost edits are release defects; aesthetic refinements can follow. Preserve the shared UI and avoid separate platform feature implementations.

## Work Kelly may eventually need to do

No immediate action. Ask directly only when a concrete prepared step needs it:

- Reconnect the Android tablet for final in-place upgrade/physical acceptance, or install the prepared APK manually. Do not request repeated OAuth or developer registrations.
- Complete an Apple/Google login, MFA, agreement or role-restricted distribution action if available sessions cannot do it.
- Decide the public Google consent branding approach because the current shared project says Instapie; do not rename a shared project's consent screen without assessing the other app.
- Approve prepared binary/store publication and website deployment, including their exact destinations. Existing permission to publish clean source persists.
- Install the iOS candidate on an available iPhone/iPad for the remaining physical acceptance. The sold iPad is unavailable permanently.

Do not stop all work for one pending external dependency: proceed with the next independent item. Never replace missing device/store proof with a production-ready claim. No new infrastructure, recurring charges, task sync or MCP implementation is included.

## Completion record

For each slice record source revision/delta, artifact hashes, commands, pass/fail counts, target device/OS, synthetic cleanup, and remaining gaps in repository documents. Raw evidence stays in ignored output. Update the handoff at each checkpoint so work survives compaction. Distinguish built, tested, approved, uploaded and publicly available states.
