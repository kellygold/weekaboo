# Credential handling review — 11 September 2026

This is a scoped source and regression review, not a penetration test or full production certification. No user passwords, tokens or signing private keys were read for this review. The native app connects directly to providers; the optional browser backend has a different deployment trust boundary.

## Storage and logging

| Runtime | Credential handling | Evidence and limits |
| --- | --- | --- |
| Android | iCloud credentials use AES-256-GCM with a non-exportable Android Keystore key and credential reference as authenticated additional data. Only ciphertext is stored in private preferences. Google and Microsoft SDKs own their authorization caches. | `WeekabooStoragePlugin.java`; cloud backup and device transfer exclude app files/preferences/databases. Existing foundation proof checks ciphertext, account isolation, deletion and restart persistence. Updated native iCloud fixture checks secret absence from account metadata. This does not claim a compromised/rooted device cannot access an unlocked app's secrets. |
| iOS/iPadOS | iCloud credentials and per-account Google session archives use nonsynchronizing Keychain entries with `AfterFirstUnlockThisDeviceOnly`. Microsoft uses its app-specific Keychain cache. | `Credentials.swift`, `WeekabooAuthorization.swift`. Physical iPad consent/provisioning passed for all three providers. Final Release native tests proved isolated Keychain policy and rejected-write preservation; actual Wi-Fi-off cold launch retained cached events. Lock/reboot and renewal/revocation remain unvalidated. The physical iPad is now disconnected for sale; do not reuse it. |
| macOS | Electron `safeStorage` encrypts credentials and SDK caches in app-private SQLite; the store fails closed when encryption is unavailable. Directory permissions are 0700, database 0600. | `desktop/storage.mjs`, `desktop/main.mjs`. Unit tests use fake encryption to test reference binding and fail-closed behavior. The separate native foundation run also passed actual macOS safeStorage with mock-keychain flags removed (`output/standalone-desktop/foundation.json`); Kelly now confirms successful Mac Google/Microsoft/iCloud consent; read-only local metadata confirms active accounts/calendars. Subsequent live Mac CRUD/readback/cleanup and full-restart account retention pass; injected outage recovery passes. True expired/revoked-token renewal remains unvalidated. Public desktop OAuth client configuration is separate from user tokens. |
| Browser with optional Python backend | Provider secrets are encrypted using Fernet with a separately configured local key. | `backend/weekaboo/integrations/crypto.py`; local `.env` is ignored and owner-readable only. This is not approval to expose the development backend publicly or send credentials over an untrusted HTTP network. Hosted authentication/access controls remain a separate project. |

Capacitor plugin-argument logging is disabled. Native errors return bounded, user-facing messages instead of raw provider exceptions. Android/Desktop Microsoft PII logging is disabled; iOS has no application-installed MSAL log sink. Task exports use explicit task fields and exclude account credentials. The UI clears an iCloud password after completion/failure or changing provider; a failed attempt therefore requires pasting it again.

Calendar cache, task records and account labels are ordinary app-private data; the vault's encryption guarantee should not be described as encrypting every database field. Ignored local evidence and backups can contain personal information and must not enter public source or release assets.

## Independent review and disposition

One Claude high-effort, read-only audit completed in 396 seconds against clean snapshot `c26a303d1b65f74e123835f526eabaf27b8e4011`. Evidence: `output/production-validation/account-feedback/security-review.md` and `security-review-status.json`. It found no concrete credential disclosure or insecure persistence in the supplied storage/cache/bridge paths. Provider implementations and backend routes were outside its snapshot, so this is a bounded conclusion.

Confirmed feedback findings were fixed and regression-tested: browser redirects no longer leave all controls disabled after Back; pageshow restores retry feedback; disconnect clears success; an empty or missing-provider account refresh does not announce success; callback success waits for matching account data and is suppressed on callback error. These final fixes are delta-proven by tests, not a second independent approval. The original eight-minute review budget was not restarted.

The reviewer flagged Android's general HTTPS transport having no native provider allowlist. Local follow-through confirms the shared CalDAV client validates every destination and redirect against HTTPS `caldav.icloud.com` / `pN-caldav.icloud.com` before attaching credentials (`src/engine/providers/caldav.ts:6`), and native redirects are disabled. Existing unsafe-redirect tests pass. A hostile server-provided href therefore does not establish the proposed disclosure; an extra native allowlist remains optional defense in depth.

Desktop browser-based consent now has explicit in-app cancellation plus a distinct five-minute timeout. Native consent dialogs retain provider cancellation. See the 11 September cancellation entry below for test and independent-review boundaries.

## Before a full public release

- Verify actual signed distribution artifacts contain no private credentials, development server URL or debugging/logging configuration; preserve the permanent signing key with an off-machine secure backup.
- Finish physical iPhone/iPad sign-in, secure-store lifecycle, renewal/revocation and account-removal checks. Preserve existing Android live evidence with exact artifact boundaries.
- Complete distribution-signature OAuth verification and remaining store/release gates in `production-validation.md`; do not equate this review with release approval.
- Keep raw device evidence and recovery files private. Never bundle the browser backend's `.env`, user credential vaults or signing keys with downloadable apps/source.

## Desktop cancellation follow-up — 11 September, 20:25 AEST

New trusted IPC cancellation interrupts interactive waits only; silent refresh continues. Shared coordinator marks the attempt before aborting, checks before preparation/commit and rolls back a newly prepared connection before metadata publication. Per-adapter generation prevents a cancelled interactive call from opening after queued silent work; account-store-read cancellation is checked before opening auth. Existing credential storage, redirect/state/host validation and network destination constraints unchanged.

Independent Claude review found the queued-interactive race in snapshot `8e5b8ecee9b44ca606a80300e8e45c9fc866221d` (205 seconds). Fixed by the author with regressions through actual DesktopAuth/native queue/oauthConnection/coordinator. Follow-up delta `bac32387810efe8f48551ed3256193ef1a38bdf7` timed out after 175.8 seconds, consuming the remainder of the original eight-minute wall-clock budget. No independent final approval; do not retry review within this session. Full shared 180/180 tests and signed packaged Google/Microsoft cancellation/retry pass. Isolated profiles cleaned; real user consent is not part of that proof. No Linear/Slack/publication side effects.
