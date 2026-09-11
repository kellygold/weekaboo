# iOS distribution preparation

## Repeatable local export

Full Xcode, locked Swift dependencies, local native OAuth configuration and Apple team signing access are required. First-clone setup is in the native OAuth guide and cross-platform plan. The command never uploads an app:

```sh
python3 scripts/ios-release.py --team YOURTEAMID --output output/ios-candidate-001
```

Use a new output directory for every candidate; previous archives and evidence are retained. The script syncs the shared renderer, archives Release, exports for App Store Connect locally, and verifies the IPA signature, profile, identifier/version, disabled debugging/logging, exact renderer bytes, native notices and the reviewed SDK privacy manifests. It writes logs and a receipt to that directory. It does not export private signing keys.

If signing is not yet provisioned and you intend Xcode to manage profiles/certificates with your existing Apple account, add `--allow-provisioning-updates`. This is an explicit Apple account mutation, not an upload. It can require Xcode sign-in/MFA or account permissions. Normal runs use installed signing material and do not enable this option.

## Current verified state — 12 September 2026

The initial local-only export failed because distribution signing was absent. Xcode managed signing resolved it using the existing account. A subsequent current-source archive/export succeeded without provisioning updates. The resulting IPA has an App Store distribution profile with debugging disabled and no device restriction; it is not the earlier one-iPad development IPA.

Current private proof: `output/google-project-migration/ios-discovery-fix/receipt.json`; exported IPA SHA-256 and runtime boundary are recorded in [current validation](current-validation.md). Earlier export receipts remain historical. All 92 renderer resources and 13 native notices across ten Swift packages match. iPhone, Mini and standard iPad simulator tests each pass six core/UI checks on iOS 26.5. The exported IPA is not installed in the simulator; export/signature proof and simulator runtime proof are separate.

## Remaining delivery gates

- Create/verify the App Store Connect app record and metadata; choose TestFlight testers. No record or upload is established by successful local signing.
- Complete privacy/data disclosures, required-reason API/SDK manifest review, screenshots and reviewer instructions. Twelve SDK manifests are retained and checked against locked revisions by `scripts/verify-ios-privacy.py`. See [disclosure evidence](privacy-disclosures.md) for reviewed behavior and open store-label questions; package checks alone do not approve labels.
- Complete the remaining provider expiry/recurrence/reconnect matrix and independent review.
- Physical iPhone/family-device acceptance and minimum-supported-iOS acceptance remain outstanding. Never use the sold iPad.
- Approve the exact prepared upload before sending the IPA to App Store Connect. External TestFlight/beta review and public App Store approval are separate steps.

No new OAuth clients or Apple membership are currently needed. All five Google clients now belong to the dedicated Weekaboo project. Fresh Android/Mac/browser/iOS-simulator consent passes. Public OAuth verification remains separate from test-user authorization.
