# Google project migration

Updated 12 September 2026. Android distribution first; preserve iOS, Mac and browser behavior. Kelly authorized creating the dedicated project and preparing provider registrations. All five registrations are received and active private Web/iOS/Mac configuration has migrated. Signing keys and local task data are preserved. Earlier receipt sections below are chronological; the active-cutover section supersedes their staged-only status.

## Verified cloud setup

| Item | State |
| --- | --- |
| Project | `weekaboo-app`, display name **Weekaboo**, number `124770503970`, ACTIVE |
| Ownership context | Created using Kelly's personal Google CLI account, with explicit `--account`; no organizational parent returned |
| Calendar API | `calendar-json.googleapis.com` enabled and independently listed |
| Billing | `billingEnabled: false`, no billing account attached |
| Other infrastructure | None provisioned; no service accounts, keys, databases, servers or deployments created |
| Consent / new clients | Kelly completed Get started; Branding screenshot shows Testing. All five new client downloads received; test users added; fresh Android/Mac/browser/iOS-simulator sign-in passes; public scope verification remains |
| Current native clients | All new registration files received for `weekaboo-app`. Android release replacement confirmed by Kelly; active iOS/Mac/Web config now uses the new project. Historical registrations used `kellygold`, number `703865103732` |

Google automatically enabled a set of default Cloud services during project creation. Those enabled APIs are not provisioned resources or billing subscriptions. Only Calendar API was explicitly added for Weekaboo. Do not add Firebase, IAP or a service-account credential to solve ordinary user Calendar OAuth.

Private, non-secret command evidence: `output/google-project-migration/cloud-setup.json`. CLI operations must explicitly select the personal account and project; the machine's default CLI account belongs to another project/work context and was left unchanged.

## Console setup to complete now

1. **Completed by Kelly, per screenshot.** Open [Weekaboo Google Auth Platform](https://console.cloud.google.com/auth/overview?project=weekaboo-app). Initialize with app name **Weekaboo**, audience **External**, and monitored contact details. Leave the audience in Testing during setup.
2. In [Branding](https://console.cloud.google.com/auth/branding?project=weekaboo-app), configure the product identity. Intended homepage is `https://weekaboo.app/`, privacy page `https://weekaboo.app/legal/privacy-policy`, authorized domain `weekaboo.app`. Terms are at `https://weekaboo.app/legal/terms-of-service`. Matching static directory-index pages now exist for both policy URLs; legacy `/privacy.html` redirects to the canonical privacy page. These website files exist locally but deployment and Search Console ownership verification remain prerequisites for public verification. Do not claim the URLs are live.
3. Current screenshot still uses Kelly’s Gmail for public support and `developer@weekaboo.app` for developer notifications. Confirm the latter forwards successfully. Remove the extra empty authorized-domain row showing `example.com`; keep only `weekaboo.app`. Choose a public support email deliberately. A forwarding alias is not necessarily selectable in Google's support-email field; verify available account/Google Group choices before exposing Kelly's personal Gmail. Private developer notification contact and public user-support address are separate decisions. No paid Workspace signup is required by this plan.
4. In [Audience](https://console.cloud.google.com/auth/audience?project=weekaboo-app), add the actual Google accounts used for testing. This is separate from the Play Console tester list; neither creates a Weekaboo login.
5. In [Data Access](https://console.cloud.google.com/auth/scopes?project=weekaboo-app), declare the scopes actually requested by the candidate. Current native flows use calendar access and email identity, with OpenID / SDK identity scopes. See the scope checkpoint below before public verification.

Standard Android/iOS/Desktop/Web OAuth clients are created through [Clients](https://console.cloud.google.com/auth/clients?project=weekaboo-app). The supported `gcloud iam oauth-clients` commands target another IAM authentication facility; they cannot create these ordinary Calendar application registrations. Project/API CLI access does not imply a supported CLI for consent branding or these clients. No authenticated Console automation is available in this session.

## Platform registrations and migration order

| Platform | Client type / identity | Configuration after creation |
| --- | --- | --- |
| Android direct release | Android; `app.weekaboo.calendar`; release SHA-1 below | Save registration JSON in ignored `data/oauth/`; AuthorizationClient resolves package/signature, so no Google secret or hardcoded Android client ID is needed |
| Google Play release | Android; same package, actual Play **app-signing** SHA-1 | Reuse the release registration only if that certificate matches; upload-key identity alone is insufficient |
| iOS / iPadOS | iOS; bundle `app.weekaboo.calendar`; existing team `63A8D3253M` | Stage plist privately, update client ID and reversed URL scheme in `ios/native-auth.xcconfig`, rebuild |
| Mac | Desktop app; system-browser loopback callback | Stage JSON privately, update `desktop/native-auth.json`, rebuild and sign; no Web client secret |
| Existing browser + local backend | Web application; callback `http://localhost:8080/api/accounts/google/callback` with current default settings | Update only private `backend/.env` Google fields; preserve other providers and encryption key |
| Android development | Android; same package with debug SHA-1 below | Keep the current registration working during release migration. Decide development-project separation before public verification rather than adding unfinished debug clients to production unnecessarily |

Public signing metadata, not private keys:

- Direct release SHA-1: `84:2C:6A:57:18:A0:19:45:49:25:69:98:84:B7:12:8D:3B:C8:5B:B7`
- Debug SHA-1: `7E:0B:37:27:7E:B4:62:2E:1C:58:B0:E5:A0:F4:93:F1:F7:14:AF:F6`

**Android collision:** Google rejects an existing package + SHA-1 pair in another project. The release identity was registered in `kellygold`; Kelly has now deleted that entry and created its replacement (see receipt below). The same collision may affect development. Prepare branding, scopes, test users and exact client details first. Then coordinate an explicit cutover of only that Weekaboo client; do not delete the project, alter Instapie's branding, change the signing key or claim both identical registrations can coexist. Deletion/recreation can interrupt sign-in and may have propagation delays. Console deletion/restoration behavior must be checked before committing to that step; a downloaded JSON file does not preserve a working registration.

For iOS, Mac and Web, stage new registrations/configuration alongside the old files, then migrate one platform at a time. Back up private configuration in ignored storage with restrictive permissions. Existing user authorization is tied to its client/project and cannot be copied into a new OAuth client. Prepare a normal reconnect flow and preserve local tasks, preferences and provider account identity. Do not revoke all user grants merely to test migration.

## Scope checkpoint before verification

The existing Android plugin, iOS adapter, desktop authorization and browser backend request `https://www.googleapis.com/auth/calendar`; email identity uses `https://www.googleapis.com/auth/userinfo.email`, with OpenID/SDK identity scopes where applicable. API enablement and consent scope declaration are different operations.

Source inspection of the shared Google reader/writer found calendar-list reads and event reads/creates/patches/deletes. A narrower candidate is `calendar.calendarlist.readonly` + `calendar.events`, alongside identity scopes. This is a proposed reduction, not a tested or shipped change. Audit the browser provider and every authorization/granted-scope validator, then validate owned/shared calendars, recurrence, meeting links, refresh and reconnect before changing declarations or submitting a least-privilege justification. Do not claim the broad scope is unavoidable just because current code requires it.

Verification packet: working product homepage/privacy, domain ownership, accurate support contact, final scopes and justifications, and a demo of consent plus the features using those scopes. Record new-project branding in that video. Testing users and unverified-use exceptions do not establish approval for unrestricted public distribution.

## Acceptance and rollback boundaries

For each migrated platform record the new public client/project identity and exact artifact. Prove consent says Weekaboo, identity discovery, calendar discovery, attendee-free synthetic create/edit/delete with provider readback and cleanup, cancellation/error recovery, restart/silent acquisition and reconnect. Confirm exact task export preservation and that Microsoft/iCloud still work. For Android, repeat sign-in on a Play-installed artifact when that track is available; a direct APK test cannot prove Play signing configuration.

Keep previous native configuration and binaries for diagnosis, but do not assume they restore a deleted Android client or that token caches are transferable. SDK-managed credentials stay on device. Never export tokens, iCloud passwords, signing keys or backend secrets with migration evidence. Current native artifacts contain the new configuration. Test-user setup is complete; fresh Android/Mac/browser/iOS-simulator authorization passes. Artifact/configuration checks alone are not successful login proof for the remaining physical-iOS/development/Play targets.

## Browser, Microsoft and iCloud boundaries

The static marketing/download site requires neither an OAuth client nor a runtime server. The existing interactive browser app currently uses the local Python backend. Preserve that client during migration. A future pure-browser Google adapter can use Google's JavaScript token model and a Web client with appropriate JavaScript origins; authorization alone does not require a server callback. Its short-lived token and user-gesture reacquisition behavior differs from native unattended access. A Microsoft SPA can likewise use MSAL with PKCE and a SPA registration. Neither approach proves direct browser iCloud CalDAV support under CORS, nor justifies embedding a confidential Web secret in JavaScript. No server-side JavaScript rewrite is planned here.

Microsoft keeps the existing Weekaboo Entra registration, public client ID `cdc54cdf-7b89-4164-bdd7-3fd0bc651535`. Recorded native sign-ins passed. Release Android callback uses `msauth://app.weekaboo.calendar/hCxqVxigGUVJJWmYhLcSjTvIW7c%3D`; iOS uses `msauth.app.weekaboo.calendar://auth`; Desktop Mac uses registered Mobile/Desktop `http://localhost`; existing browser callback is `http://localhost:8080/api/accounts/microsoft/callback`. No Entra console changes or fresh live audit occurred during this Google setup. Check Play app-signing identity, final public branding/contact/domain and organizational consent restrictions before broad release. Some organizations require admin approval for an unverified publisher; a working personal Outlook account does not prove every tenant will accept the app.

iCloud remains native direct CalDAV with per-user app-specific passwords and protected device storage; no new OAuth client or project migration is needed. Existing provider release-validation gaps remain tracked in current-validation.md.

## Primary references checked 12 September 2026

- [Google client types and Console creation](https://support.google.com/cloud/answer/15549257?hl=en)
- [Android package/signature collision](https://support.google.com/firebase/answer/6401008?hl=en)
- [Sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Calendar list scope choices](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list) and [event patch scope choices](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch)
- [Browser Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Microsoft code/PKCE flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) and [publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)

## Policy route preparation — 12 September

Prepared the existing privacy copy at `/legal/privacy-policy/`, added plain-language terms at `/legal/terms-of-service/`, and linked both from the homepage. Terms preserve MIT rights and do not add a subscription, account or paid service. Privacy explicitly covers Google data use, provider processing and support emails. Contact uses Kelly’s configured `developer@weekaboo.app`; delivery is not independently verified. These are local drafts pending content approval and static deployment, not a claim of legal or Google verification. Browser checks cover nested routes, relative assets, navigation and overflow under a GitHub Pages project prefix. The no-trailing-slash URLs entered in Console resolve through directory redirects on static hosting.

## Web credential received — 12 September

Kelly downloaded the new Web client. Validated project `weekaboo-app`, project-number client prefix and exact callback `http://localhost:8080/api/accounts/google/callback`. Moved the download to ignored `data/oauth/google-web-weekaboo.json` with owner-only permissions (0600), verified the copy before removing the Downloads file. Client secret was not printed or added to source. Staged only: `backend/.env`, running backend and current account grants remain unchanged until the new project’s scopes/test users and reconnect cutover are ready.

## iOS credential received — 12 September

Kelly downloaded the new iOS plist. Validated the Weekaboo project-number client prefix `124770503970`, bundle `app.weekaboo.calendar`, and matching reversed-client callback scheme. The plist has no PROJECT_ID field; project membership was checked by the client-number prefix. Moved to ignored `data/oauth/google-ios-weekaboo.plist` with owner-only permissions (0600), verified the copy before removing the Downloads file. Staged only: existing `data/oauth/google-ios.plist`, `ios/native-auth.xcconfig`, installed apps and provider grants remain unchanged pending coordinated migration and re-consent validation. No credentials were printed.

## Android release registration moved — 12 September

Kelly confirmed deletion of the old Android release OAuth client resolved the package/fingerprint collision and created the replacement in Weekaboo. Received the newest installed-client JSON and verified `project_id=weekaboo-app` and client-number prefix `124770503970`. Moved to ignored `data/oauth/google-android-release-weekaboo.json` with owner-only permissions (0600); byte verification preceded removal from Downloads. Package/fingerprint are not independently established by those JSON fields; the release identity mapping is user-reported until live sign-in proves it. The old release registration must no longer be described as intact; its historical JSON remains locally for reference. Android uses package/signature discovery, so new registration can affect current release builds without changing their binary. New-project live authorization and consent-branding validation remain pending. Existing Web/iOS configuration is still staged, and development/Mac clients are pending Kelly’s remaining registrations. No local native config, device credentials or tasks were changed.

## Remaining clients received — 12 September

Kelly supplied Android Development and Mac downloads. Both installed-client JSON files identify `weekaboo-app` with prefix `124770503970`. Mac includes the expected Desktop `http://localhost` loopback registration; the other file has the expected Android installed-client shape without a secret/redirect list. Android package/fingerprint still requires Console or live authorization evidence; JSON does not contain it. Files moved to ignored `data/oauth/google-android-development-weekaboo.json` and `data/oauth/google-desktop-weekaboo.json`, owner-only 0600 permissions, verified before removing Downloads copies. No secrets printed.

All five new-project credentials are now received: Web, iOS, Android Release, Android Development and Mac Desktop. Active Web/iOS/Mac configuration has not been switched. Android OAuth changes are provider-side; live release/development sign-in remains unverified. Next: confirm new-project test users/scopes, preserve private prior configurations, apply Web/iOS/Mac configuration changes one platform at a time and validate consent/reconnect plus local data preservation. Do not count old-project sign-in evidence as proof of new-project authorization.

## Active cutover and fresh authorization — 12 September

Updated only Google fields in private `backend/.env`, `desktop/native-auth.json` and `ios/native-auth.xcconfig`, and replaced canonical local credential downloads. Previous files are backed up under ignored owner-only `output/google-project-migration/active-cutover/before-*`. Non-Google backend settings and encryption key were compared unchanged. Receipt: `active-cutover/configuration-receipt.json`. No credential values were logged or committed. The loopback browser backend was restarted with access logging disabled.

Android release uses Google package/signature discovery, so no APK rebuild is required solely for this registration migration. Installed bytes remain SHA-256 `3fb084b4430bb15451feae413022b45816b1d1664952a8ddac4257daeb1a12b0`. A same-signed temporary instrumentation test requested a fresh grant without exporting tokens. Google displayed Weekaboo and rejected the selected test account with 403 because it is not developer-approved in the new project's Testing audience. Kelly must add intended Google addresses in [Audience → Test users](https://console.cloud.google.com/auth/audience?project=weekaboo-app). The test APK was removed and the normal app reopened; app data was not reset. Rerun instructions and private screenshot/receipt: `output/google-project-migration/android/`.

The iOS App Store IPA is `output/google-project-migration/ios/app-store/export/App.ipa`, SHA-256 `3ba8e0b77d1308658352da994b6ac7a59af704d15254951efd7335263098d4b7`. New Google client/scheme and preserved Microsoft scheme verified in archive, export and simulator binary. Existing Apple signing worked; signature/profile, 92 renderer files, 13 native notices and 12 privacy manifests checked. All18 fresh iOS26.5 simulator cases pass (iPhone17Pro, iPadMiniA17Pro, iPadA16). Those disposable test devices were removed. A separate fresh simulator is retained for real consent: `F18043A2-D6F3-4A75-9BFA-7BF07FBF5330` (`Weekaboo Google Consent 20260912`). It has no existing personal accounts. Receipt: `output/google-project-migration/ios/receipt.json`.

Signed Mac app rebuilt with the new Desktop client and passed isolated packaged smoke testing. Current signed bundle and DMG receipts are under `output/standalone-desktop/`; live reconnect receipt is under `output/google-project-migration/mac/`. Old Mac/iOS artifact hashes in earlier validation tables are superseded by these configuration rebuilds. No notarization or public upload occurred.

TypeScript and 179 Playwright regression cases passed; four synthetic Mac client-binding checks passed. Evidence: `output/google-project-migration/regressions/`. Existing fresh access tokens can keep old-project accounts looking healthy, especially Android/browser; never treat that as proof of migration. Mac/iOS caches are client-bound and require normal reconnect. Remaining: allowlist, real consent/new-project audience, identity/calendar discovery, guarded synthetic CRUD/readback/cleanup, silent acquisition/restart and preservation for each platform. Android development and Play-installed artifacts need their own appropriately signed checks; direct-release proof is not Play signing proof.

### Discovery isolation follow-up

Root found that shared manual discovery aborted on Google’s client-bound reconnect error before reaching Microsoft/iCloud. Source fix continues providers, preserves failed calendar metadata and marks their health; it only throws after all providers fail. Local persistence errors remain failures, outside the provider catch. Two failing-before/passing-after regression cases and 28 engine/write passes are recorded in `active-cutover/discovery-{before,after}.log`. Full regression rerun is delegated; no native build contains this change yet. Rebuild/retest across Android, iOS and Mac after review.

Mac live partial evidence: `mac/unchanged-providers-1789163919590/receipt.json` proves Microsoft create/readback and cleanup, plus successful iCloud reads; edit-form submission stalled with no PATCH sent. Cleanup=true. Root is checking form validity in a new bounded attempt; do not mark full CRUD passed. Initial probe only failed a transient refresh-indicator assertion before any remote mutation.

Shared fix committed as `d3bcf4b`: added optional persisted `discoveryNeedsAttention` metadata so successful event reads cannot clear a failed discovery warning. Full safe suite182/182, tsc, exact-commit engine22/22 pass. Previous warning-loss observation was reproduced and resolved. Scoped different-lab review running against a clean detached worktree; Android/iOS/Mac rebuilds in progress. Google allowlisting remains the only immediate owner action for fresh Google consent.

Mac diagnostic retry `mac/unchanged-providers-1789164110515/receipt.json` passed Microsoft and iCloud create/edit/delete/readback, cleanup, restart, tasks and settings preservation on the pre-fix migration package. Prior failed edit attempt retained; diagnostic form controls were all valid and retry succeeded. Root must rerun current-package acceptance after rebuild; no claim of live Google migration or true expiry.

Scoped independent Claude review of `d3bcf4b` against `e91fbd0` completed in180seconds from a clean detached worktree: no blocking findings. Private verdict: `output/google-project-migration/discovery-review/verdict.md`. Nonblocking observations include warning recovery requiring explicit discovery refresh, generic stale-cache copy and the status category after mixed auth/network failures; none establishes whole-product readiness. No new publication approval is implied.

## Current completed checkpoint — discovery fix on all native packages

Runtime `d3bcf4b`, configuration `weekaboo-app`. Android in-place upgrade is complete: exact three-task snapshot and account/calendar selections retained; no reset or fresh Google attempt. iOS18/18 simulator cases pass and signed IPA verifies separately; retained Google Consent simulator updated in place and launched, with persisted files unchanged. Mac current-package Microsoft/iCloud CRUD/readback/cleanup/restart/settings proof passes (`mac/unchanged-providers-1789164513260/receipt.json`); isolated package and mounted DMG proofs also pass. Browser backend health200 and existing per-account discovery isolation confirmed.

Exact current artifacts are in `output/distribution-candidate/manifest.json`/`SHA256SUMS` and current-validation.md. Previous migration-only hashes are historical; the current manifest identifies d3bcf4b binaries. Independent review found no blocking scoped issue. Source/history scan has zero secret findings; owner-only configuration files remain ignored. Source publication authorization does not authorize binaries, website deployment or stores.

Next owner-dependent work: Google Testing allowlist, then actual new-client consent on Android, Mac, browser and the retained iOS simulator. Android safe audience-proof rerun is documented under `android/PROBE-README.md`; its initial baseline APK hash is historical after this upgrade—verify the current installed hash before rerun. Keep tokens within the device, and do not revoke whole grants or reset apps. Re-run client-bound identity/calendar/CRUD/silent acquisition checks after consent. Microsoft/iCloud did not need new registrations. The isolated Android development emulator still lacks live Google consent; Play-delivered certificate acceptance remains distinct from direct APK.


## Fresh consent after test-user setup — 12 September

Supersedes the earlier allowlist-blocked checkpoints. Source HEAD at test start `6b42bd5`; native runtime `d3bcf4b`, unchanged artifact hashes in current-validation.md. Kelly added the intended Google test users and completed Android, Mac, browser and iOS simulator sign-in. No new client, rebuild, app reset or grant revocation was needed.

| Surface | New-project proof | Preservation / remaining boundary |
| --- | --- | --- |
| Android physical direct release | On-device token audience equals the new release client; selected-account identity and calendarList each HTTP 200, three calendars. Actual Connect Google shows success and healthy discovery survives full process restart | Exact three original tasks and all provider sections retained; instrumentation removed; credentials remained on device. Live CRUD was not repeated in this slice: the fixture write harness targets a disposable emulator; the older physical live harness needs WebView inspection, which is disabled in the release APK |
| Mac signed package | Real Keychain, normal profile, system-browser consent with new Desktop client and successful callback; account becomes active. Google UI create/edit/delete has direct readback and verified synthetic cleanup; restart/silent acquisition pass | All account IDs, task document and calendar settings retained. Current-candidate Microsoft/iCloud CRUD already passed separately. True token expiry and notarization are not established |
| Existing browser/backend | Fresh callback stores new Web-client grant; token audience, selected-account identity and calendar discovery verified. Real refresh-token exchange with the new client succeeds. Browser UI create/edit/delete passes with backend and Google readback, reload and synthetic cleanup | All five account IDs and calendar selections retained. One selected Google account reauthorized; other existing Google accounts may still retain old grants. Browser-local tasks were not modified; CRUD used an isolated browser context and one guarded attendee-free fixture |
| iOS simulator | User completed fresh consent with the embedded new-project client. Native SQLite changed from zero accounts to one active Google account and three discovered calendars; fetched event cache and visible meetings verified | Restart preserved account/calendar settings exactly and all 24 fetched events. UI CRUD was not performed: macOS denied assistive control. No physical-device or exported-IPA execution claim; prior 18/18 core cases remain valid for unchanged runtime |

Private evidence: `output/google-project-migration/allowlisted/android/receipt.json`, `mac/reconnect-receipt.json`, `mac/google-live-1789166196486/receipt.json`, `web/consent-receipt.json`, `web/live-receipt.json`, and `ios/receipt.json` beneath that same directory. Mac and browser synthetic records were deleted and independently confirmed absent/cancelled. Raw screenshots, account identifiers and auth data remain excluded from source. Browser tokens stayed inside the local backend process; Android tokens never left the device.

Next: finish remaining live write/lifecycle boundaries; retain development-client and Play-installed acceptance as separate unproved targets. Public OAuth verification, hosted policy URLs, store setup/testing, Mac notarization and publication approval remain release gates. Test-user success does not establish unrestricted public Google access.
