# Android release preparation

## Current native acknowledgment gate

Release/bundle preparation checks the locked native dependency graph and preserves 153 notice files for 91 artifact/project records, with zero unresolved entries. Exact compiled-artifact and notice digests bind the reviewed supplements to this version. New unresolved dependencies block release/bundle builds. See the reproducible acknowledgments section below; private evidence is under `output/production-validation/android-license-evidence/`.


Status: local signed candidate, not publicly released or production-approved. Package `app.weekaboo.calendar`. Kelly confirmed Play identity verification and registration of the dedicated release certificate.

## Build

`npm run android:release` builds a signed APK and AAB without installing or uploading. It uses existing owner-only files in `~/.config/weekaboo/signing/` by default, or `WEEKABOO_SIGNING_DIRECTORY`. Expected names are `android-release.p12` and `android-release.password`; alias `weekaboo-release`. Never regenerate or replace a release identity. Store a secure off-machine backup before distribution; this is still pending. Passwords/private keys must not enter source, docs, logs, or downloadable assets.

Gradle derives the Microsoft native callback hash from the actual certificate and overrides only release resources/manifest. Debug registration remains unchanged. Both `android:release` and `android:bundle` require the existing external release-signing configuration. Public native Microsoft client configuration remains in ignored `android/native-auth.properties`.

## Current artifacts and evidence

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Exact hashes/status: `output/production-validation/android-current-candidate.json`
- APK signer verification: `output/production-validation/android-current-signature.txt`
- Public certificate/fingerprints: `~/.config/weekaboo/signing/android-release-public.json`; copyable registration fingerprint at `output/production-validation/android-release-public.txt`.

APK signature verification succeeds, package matches, debuggable is false, and Microsoft manifest callback matches signer. AAB jarsigner and bundletool validation pass; store acceptance remains untested. The current APK was installed in place on the reconnected physical Android tablet, retaining all three provider connections and an exact three-task export comparison. Current physical evidence is under `output/production-validation/android-tablet-current/`; see `current-validation.md` for scope.

## Next gates

1. **Completed:** release-signature Google/Microsoft registrations supplied by Kelly; physical release installation connected to all three providers. Retain those entries. Do not ask to repeat them.
2. **Completed:** debug-to-release transition, reconnect and task export/restore. The reconnected tablet subsequently passed a same-certificate release-to-release update with exact task preservation; no uninstall/reset.
3. Run release first install, restart/offline, live provider consent/refresh/CRUD, task transfer, interactions and release-to-release update tests. Keep exact artifact receipts and synthetic cleanup.
4. Review signing changes independently, secure backup, validate AAB with bundletool, audit asset licenses/privacy/store metadata and current personal-account test-track requirements.
5. Play App Signing is not enrolled yet. Plan upload-key separation and whether to import this app-signing key for matching direct-download and Play updates. If Play signs with a different app certificate, its installed-app certificate needs separate OAuth/registration; an upload certificate is not the installed-app identity.
6. Prepare a concrete store upload/release for review. No public submission authorized by key registration alone.

Google package registration reference: https://support.google.com/googleplay/android-developer/answer/16761053 .

## Reproducible native acknowledgments — 11 September

Runtime dependency versions are locked in `android/app/gradle.lockfile` for debug/release. Normal builds fail on lock drift. Deliberate dependency updates use `:app:dependencies --write-locks`; review the resulting graph and corresponding notice changes together. `licenses/android/supplements.json` binds reviewed upstream texts to exact compiled-artifact digests. New versions, changed artifacts, corrupted notices and unsafe paths are rejected. `python3 scripts/native-android-notices-test.py` exercises these boundaries.

The current inventory has 91 resolved artifact/project records and 153 preserved/supplemental files, with zero unresolved entries. Google client SDK terms remain separate from MIT. The legacy Surface Duo display-mask compile stub is excluded; its only SDK use has a guarded fallback, exercised on ART by `MicrosoftDisplayFallbackTest`. The separate Duo Maven feed and generated example tests were removed. This completion covers acknowledgments only, not all release gates.

Both `npm run android:release` and `npm run android:bundle` load the existing external signing configuration; neither generates a key. To run the real release instrumentation on an explicitly selected validation device, use `ANDROID_SERIAL=<serial> WEEKABOO_SIGNING_DIRECTORY=<existing-directory> android/gradlew -p android :app:connectedReleaseAndroidTest` with JDK 21. Never substitute the sold iPad or reset the personal tablet.

## Shared version metadata

`package.json` supplies `version` and `weekabooBuild` to Gradle and desktop packaging; `npm run version:sync` generates the Apple settings. Current version is 0.1.0 / build 1. `python3 scripts/verify-release-artifacts.py` checks actual local artifacts rather than trusting source configuration. It never installs or uploads.

Current AAB follow-through: `output/production-validation/android-bundletool-proof.json` records bundletool 1.18.3 validation and generated universal APK signature proof. AAB `jarsigner -verify` also passes, with ordinary local-certificate/ZIP warnings retained in its log. These checks are local; no Play upload or store acceptance. Build metadata/signature/file checks can be repeated with `python3 scripts/verify-release-artifacts.py`.
