# Weekaboo: standalone cross-platform implementation plan

**Decision date: 11 September 2026. Status: accepted architectural direction; Stage 0 baseline and current-UI Stage 1 service extraction implemented; Stage 2 native foundations partially proved. See standalone-progress.md for exact gaps.**

This is the canonical plan for the next implementation session. It supersedes the mandatory-hosted-backend recommendation in the [10 September proposal](history/2026-09-10-hosted-architecture-proposal.md). Product interaction decisions remain in [product-direction.md](product-direction.md). Read [platform reference notes](platform-reference-notes.md) for the researched authorization mechanisms, sources, costs, and remaining validation questions. Read [implementation handoff](implementation-handoff.md) for the starting files, evidence and immediate work order.

Current implementation evidence is tracked in [standalone progress](standalone-progress.md). Android Google/MS native authorization and all three shared read providers are implemented; Google/MS and individual iCloud writes pass synthetic native CRUD, while real consent and iCloud recurrence parity remain unproved. iOS project/core adapters are prepared but not compiled; see the exact status matrix.

Early external dependencies and signing findings are tracked in [user dependencies](user-dependencies.md). Resolve those proactively while doing independent implementation work.

## 1. Outcome and explicit constraints

Weekaboo is a free, open-source calendar and task application that someone can install, connect to their existing calendar accounts, and use without deploying infrastructure. Android tablets are the first standalone target; iPhone and installed desktop support must reuse the same product code. Delivery priority is Android first, iOS second, macOS app/DMG third. Preserve the working React browser application throughout. Production-quality web, Android and iOS behavior is the convergence goal; full standalone browser provider coverage is an unresolved delivery gate, not a discarded requirement. Browser completion can be deferred while Android/iOS progress, with limitations explicitly tracked.

- No required Weekaboo server, cloud database, tunnel, subscription, license server, or always-on computer in this phase.
- No mandatory Weekaboo login. Calendar connections are authorized independently on each device, as in a conventional calendar client.
- Each installation talks directly to Google Calendar, Microsoft Graph and iCloud CalDAV. Their services synchronize calendar records between devices connected to the same calendars.
- Shared React UI, TypeScript domain/services and provider adapters; small runtime-specific authorization, storage, networking and lifecycle adapters.
- The current Python backend is a working migration baseline and temporary development adapter, not the target installed-app dependency. Do not embed a Python web server in the tablet as an expedient substitute.
- Keep tasks as Weekaboo-owned records, including undated tasks, deadlines, focus dates, scheduled blocks and completion history. Cross-device task synchronization is not solved by calendar authorization and is not silently included in this milestone.
- `weekaboo.app` is the intended public project/download website. Purchase/ownership/DNS are not verified. Static GitHub Pages hosting is the proposed route; link to source, documentation and downloadable releases.
- Kelly does not want to build a marketing operation or subscription business. A paid hosted service is an optional future possibility, with no current implementation, infrastructure or acquisition work allocated to it.
- **Budget constraint: no project operating charges beyond the domain.** No metered backend, paid authentication, recurring AI, analytics or monitoring dependency. Free-tier allowances are limits, not a guarantee of permanent zero cost. Native distribution fees are a separate unresolved constraint; do not silently spend or assume an existing membership covers them.

Android will ship as a native APK/AAB and iOS as a native signed application suitable for TestFlight/App Store submission, using the shared React UI through Capacitor. These are not merely PWAs. macOS now uses an Electron desktop container and local app packaging around the same shared product; DMG and release signing remain separate validation gates. Store acceptance is external and must not be promised.

The initial success experience is: install on Kerryn's tablet, connect the desired accounts, see/edit calendars, keep tasks locally, restart successfully, and continue operating with Kelly's Mac switched off. Dynamic home IPs are irrelevant: calendar traffic is outbound HTTPS and native authorization returns to the installed application.

## 2. Engineering principles (one definition per principle)

These four categories have distinct responsibilities. Subsequent sections apply them; they should not grow duplicate lists of the same principles.

### Genericism: stable behavior across providers and platforms

G1. Define interfaces around capabilities the app needs, not a vendor SDK's response shape. Keep SDK types, SQL rows, OAuth URLs and HTTP response objects out of React/domain contracts.

G2. Separate the two variation axes: **provider** (Google/Microsoft/iCloud semantics) and **runtime** (Android/iOS/desktop/browser facilities). Provider adapters consume runtime services; do not create a complete Google implementation for every operating system.

G3. Expose real differences through typed capabilities and results. Do not reduce everything to the weakest provider or pretend unsupported operations work. Recurrence scope, rich notes and shared-calendar access must be explicit.

G4. Introduce only abstractions backed by actual variation. Avoid a generic plugin marketplace, dependency-injection framework, arbitrary universal entity model or configuration language. A typed constructor/factory and a small provider registry are sufficient initially.

### Production readiness: predictable data and failure behavior

P1. Treat durability and recovery as user-visible correctness. A saved local edit survives a crash; a remote save is acknowledged only after confirmation. Pending, failed, conflicted and uncertain outcomes are distinguishable.

P2. Design credentials and untrusted content as security boundaries. Use platform credential protection, supported authorization flows, least-necessary permissions, sanitized descriptions and redacted diagnostics.

P3. Preserve calendar semantics under time zones, daylight saving, recurrence, concurrent edits and interrupted requests. Validate transitions and failures as well as successful CRUD.

P4. Release based on reproducible evidence from the built application and real devices. Passing mocked tests or a frontend build alone does not establish native authorization, storage, lifecycle or distribution readiness.

### Open source: independently usable and maintainable

O1. Publish the complete implementation needed to build and use the supported standalone app. No proprietary runtime dependency on Kelly's infrastructure, private packages or unpublished provider proxy.

O2. Preserve third-party notices and provenance while applying the intended MIT license to Weekaboo-owned code. Code, fonts, generated media and SDK dependencies require their own correct attribution/distribution treatment.

O3. Distinguish source availability from turnkey official binaries. Document independent build/signing/provider registration; official client IDs are public configuration, while private signing keys and credentials never enter the repository.

O4. Make contribution and maintenance expectations clear: setup instructions, behavior tests, architecture map, security reporting route, release notes and known limitations. No service-level promises or paid support obligation by default.

### Code organization: clear ownership and navigable changes

C1. Give each module one coherent responsibility and explicit dependency direction. Domain code must not import React, native SDKs or provider clients.

C2. Assemble dependencies at a runtime composition root. Components invoke services; platform detection and construction live in entry points rather than scattered conditional branches.

C3. Keep related behavior, fixtures and tests discoverable together. Avoid oversized global utilities, duplicated DTOs and new all-purpose services. Use consistent names and shared UI controls.

C4. Migrate in complete vertical slices. Preserve working behavior, retire replaced implementations, and remove dead code after evidence and recovery checks. Do not retain two independently evolving integration engines indefinitely.

## 3. Architectural boundaries

```text
React views, editors and shared design system
                    |
AccountService / CalendarService / TaskService
                    |
Domain + local repositories + synchronization coordinator
                    |
Google adapter | Microsoft adapter | iCloud adapter
                    |
Authorization / CredentialVault / HTTP / Database / Lifecycle
                    |
Android        iOS          Desktop          Browser/dev
```

### Shared domain and application services

- AccountService: discover configured provider capabilities; connect, reconnect, disconnect; expose account identity and status. Removing a connection clears local access/cache according to policy and does not delete remote calendars/events.
- CalendarService: list accounts/calendars; read events by range; create, update and delete with explicit scope/revision; configure visibility; request refresh; report per-account/calendar sync status.
- TaskService: capture/update/reorder/complete/reopen/delete/export/import. The UI, future shortcuts and optional natural-language draft input all use this same command boundary.
- SyncCoordinator: bounded per-account work, incremental cursors, pagination, polling/resume refresh, durable writes, reconciliation, rate limits, retry classification and cancellation.
- Repositories: transactions and schema migrations; domain code uses typed operations instead of raw SQL or IndexedDB transactions. Persist only what is needed for offline use and safe synchronization.

The current `CalendarProvider` interface only exposes reads and is not the complete future contract. Add command and account boundaries before porting networking. Preserve an HTTP-backed development implementation to keep the current UI functioning during extraction.

### Provider adapters

Provider modules own endpoint selection, payload conversion, discovery and paging, revision extraction, recurrence representation, notes preservation and provider error interpretation. They do not own native callback routing, raw keychain APIs, UI dialogs or background timers.

Use a tagged provider configuration rather than an untyped dictionary. Examples of capability dimensions:

- editable calendar versus read-only;
- recurrence scopes: single event, occurrence, series, following;
- editable description format: plain or sanitized rich text;
- imported attendee statuses versus attendee mutation;
- existing conference link versus conference creation;
- shared calendars discoverable for this account and current scopes.

Capabilities derive from both implementation support and actual account/calendar permissions. They may change after consent or a refresh. A global provider flag alone is insufficient.

### Runtime adapters

- Authorization: account selection, consent, obtaining usable access credentials, cancellation, revoked grants and interactive recovery.
- CredentialVault: secure references to tokens/passwords; platform-backed protection and backup exclusions. Do not assume every platform SDK gives us its refresh token.
- HTTP: timeouts, cancellation, redirects, conditional headers, response headers/status and native networking. CalDAV needs XML bodies and methods such as PROPFIND/REPORT/PUT/DELETE, not only JSON GET/POST.
- Database: browser IndexedDB during development; durable native storage selected after a transactions/migration proof. SQLite is the likely native option, not a selected plugin yet.
- Lifecycle: foreground/resume, connectivity signals, optional background opportunities, screen-awake integration. Connectivity signals are hints; requests still need failure handling.
- Platform links: external meeting/maps links and native authentication handoff. Opening a meeting provider is intentional; ordinary event editing remains inside Weekaboo.

For Capacitor, native networking must be explicitly used/configured; a WebView's default fetch is not automatically a native transport. Test header fidelity, redirects and binary/text serialization, especially for CalDAV. Restrict authenticated redirects to expected provider hosts; never forward credentials to arbitrary locations.

## 4. Authorization without a Weekaboo server

### User-facing flow

1. Install Weekaboo and choose a provider under Connected calendars.
2. Google/Microsoft show their supported system authorization experience; iCloud requests the account identifier and app-specific password.
3. The runtime adapter binds the result to the in-progress connection, stores credentials securely, and returns a normalized account reference.
4. Shared discovery imports calendars; the user selects which to display and how to group them.
5. The same device refreshes its access through the supported SDK/token mechanism. A revoked connection becomes reconnect-required without affecting other accounts.

The same accounts must be connected independently on another device. Provider calendar sharing is configured through the provider's permissions; Personal/Work groups are filters, not access-control boundaries. Anyone with access to an unlocked shared tablet may see its connected data. This phase does not implement private multi-user sessions on a single tablet.

### Callback and registration matrix

| Runtime/provider | Return mechanism | Maintainer registration |
|---|---|---|
| Android / Google | Google Identity Services AuthorizationClient result delivered to the app | Android OAuth client bound to package name and signing certificate; use supported SDK, not a generic custom URL scheme |
| Android / Microsoft | MSAL Android redirect, normally `msauth://<package>/<signature>` | Entra Android platform configuration with correct package/signature and supported audience |
| iOS / Google | Google iOS SDK app URL scheme based on registered client | iOS client with bundle ID and URL handling |
| iOS / Microsoft | MSAL app URL scheme, normally `msauth.<bundle-id>://auth` | Entra iOS/macOS platform configuration and corresponding app settings |
| Installed desktop | Supported native system-browser flow; temporary loopback listener where supported | Provider desktop/public-client registration with compatible loopback URI |
| Browser | Registered web/SPA HTTPS origin and redirect; provider-specific browser flow | Separate browser client configuration; does not establish iCloud browser support |
| iCloud on installed platforms | No OAuth callback in the current app-password CalDAV model | No Google/Microsoft-style redirect registration; direct TLS connection with user credential |

Exact native SDK setup, package IDs, signing fingerprints and redirect values must be recorded when implemented. The current web client IDs/secrets and localhost callback configuration are not the native configuration. Do not silently edit/break the working development clients; add distinct native registrations as needed.

Use public-client flows and PKCE where applicable; follow SDK handling of state/nonce/response binding. Do not write our own token broker to unify appearances. Never bundle a server client secret into a native app. A desktop loopback listener is temporary and local to that computer, not a deployment at someone's house. Google does not support reusing desktop loopback or arbitrary custom-scheme flows on Android; see the reference notes.

One official signed build uses the maintainer's platform registrations across many installations. Users do not create OAuth projects. Fork authors with different package IDs/signatures may need their own registrations; document that distinction. Provider verification, consent publishing, organizational policies and quotas still apply even without our server.

### Shared authorization contract

Expose operations such as connect, acquire authorized access, invalidate rejected access, reconnect and disconnect. A bearer-token result may include expiry, but refreshing is an implementation detail. A result may instead report user-action-required, cancellation, unavailable platform or denied scopes. iCloud uses a separate credential kind; do not fake an OAuth token for it.

Only provider/transport code receives usable credentials. React receives an account ID, display identity, scopes/capabilities and status. Do not make components handle authorization codes or log token-bearing SDK objects. Keep credential references distinct from serializable account metadata.

## 5. Portable data model and persistence

- Use opaque, stable app IDs for accounts, calendars, events, tasks and queued operations. Stop exposing SQLite integer IDs as the UI's permanent identity.
- Preserve provider references separately: account subject/tenant where needed, calendar ID, event ID or CalDAV href/UID, recurrence master, occurrence identity and revision/ETag. Email is a display value, not the only stable identity.
- Keep recurring occurrence identity tied to the provider's original recurrence identity, not only its current moved start time. Sorting/display dates can change without creating a new logical occurrence.
- All-day events have date-only boundaries with explicit exclusive end semantics. Timed events carry instants plus named time zone. A deadline date must not shift because the device changes zones.
- Task focus date, due date, scheduled block and completion date remain separate. Preserve task identity when adding/removing time; a scheduled task is still not a provider event.
- Retain a local canonical task store and local calendar cache. Persist pending commands atomically with their optimistic local changes, and persist cursors only when the associated imported page/change set is committed.
- Version schemas and exports. Migration failures preserve the old data and expose recovery; no silent reset. Native uninstall can remove local data, so export/backup must be a documented feature before relying on local-only tasks.
- Initial task transfer is explicit, versioned export/import from the existing browser origin. Preserve IDs, ranks, notes, dates and completion metadata. Import must be repeatable without duplicating records and report conflicting versions. Keep the source unchanged until verified.
- Do not copy browser/backend OAuth credentials into exported tasks. Reconnect accounts on each new installation. Migrate calendar preferences only when their provider identities can be reconciled safely.

### Cross-device data boundary

Calendar events synchronize through their existing provider accounts. Weekaboo tasks, custom groups and preferences do not. This must be stated in onboarding/docs rather than implied by connecting matching email accounts.

Cross-device task sync remains a future decision. Possibilities include user-controlled storage or an optional service, but none is selected or proven. File sync is not automatically safe database sync; do not put a live SQLite database in a shared drive. Do not smuggle tasks into calendar descriptions or assume Apple Reminders maps to generic CalDAV tasks. Stable IDs/revisions and export formats leave room for future synchronization without building an unused distributed system now.

## 6. Provider correctness to retain and strengthen

The Python adapters contain learned behavior that must survive the port; do not rewrite from API happy-path examples alone.

| Area | Required handling |
|---|---|
| Google recurrence | Named start/end timeZone on recurring timed writes; correct UTC UNTIL; preserve parent and instance identity |
| iCloud recurrence | Preserve TZID and VTIMEZONE; expand recurrence in local zone then convert to UTC; local BYDAY and exception matching; whole-series versus detached occurrence scope |
| Microsoft recurrence | Preserve supported patterns and reject unsupported patterns explicitly; preserve Windows/IANA mapping attribution |
| Concurrent edits | Carry revision from the edit's base snapshot; conditional writes; a 412 is a conflict, never permission to fetch a fresh ETag and resend stale content |
| Partial updates | Avoid dropping untouched provider fields, attendees, generated meeting content or recurrence metadata; represent user field intent |
| Notes and meetings | In-app editing, sanitized rich text where supported, plain iCloud notes, protected Microsoft meeting blocks, deduplicated meeting links |
| Sync reset | Handle invalid/expired cursor with full reconciliation that preserves pending writes and IDs; absence means deletion only after a complete authoritative snapshot of its defined range |
| Discovery | Multiple accounts, all pages, read-only calendars, disabled sync, shared scope/audience differences, removals and reconnect |
| Error classes | Denial/cancel, auth required, forbidden, validation, conflict, rate limit, transient network, permanent failure and uncertain commit |

### Ambiguous writes and retry identity

Before enabling durable automatic create retries, fix the known Google/iCloud duplicate-create risk. Persist a stable operation ID before sending. Candidate strategies: a provider-valid deterministic supplied Google event ID; stable iCalendar UID/resource href with conditional creation and lookup/reconciliation; Microsoft's stable transactionId. Validate each against current provider semantics before selecting it. The existing Microsoft fake proves stable identity in its request, not live indefinite deduplication guarantees.

A timeout after sending may mean the provider committed. Reconcile that outcome instead of blindly creating again. Updates/deletes also need post-timeout resolution. Retrying must preserve preconditions and user intent; 401 recovery is bounded, 429/503 respect Retry-After/backoff, and 403/validation errors do not loop forever. Serialize writes per logical resource, while allowing unrelated accounts to make progress.

The current engine has timestamp-based record-level reconciliation, not full field merge. The new design should preserve the base revision and changed fields; detect newer remote changes explicitly. Any policy improvement needs tests and should be recorded rather than accidentally changing behavior during porting.

## 7. Platform scope and runtime selection

**Android first:** Capacitor wrapper around bundled React assets; native auth/HTTP/vault/storage adapters. Test on Kelly's actual tablet, with no dev server URL embedded. Add platform permissions only when needed. A second independently configured device should observe provider edits from the first.

**Desktop (third priority, macOS first):** preserve the current browser development harness during migration. An installed desktop container is the most direct route to the same device-side engine. The bounded foundation proof selected Electron 44.3.0 on 11 September: shared TypeScript provider engine plus narrow Node/Electron adapters, at the cost of a larger Chromium runtime. See platform-reference-notes.md and standalone-progress.md for source, proofs and release gaps. Do not choose solely for binary size or claim Capacitor supplies a complete desktop solution. No full provider engine reimplementation in Rust/Swift/Kotlin.

**iOS (second priority):** same React/core/providers, native SDK and vault adapters. Test returning from consent, cold-start callback delivery, storage and suspended-app recovery. Use the existing Apple developer team where eligible; local inspection found a Developer ID Application identity for macOS, not iOS signing identities. Prepare Xcode, iOS app registration and provisioning early while Android work proceeds. Resolve access/renewal issues specifically rather than deferring iOS based on an assumed new membership charge. Local development signing is not the final public distribution plan.

**Browser/PWA:** retain and improve the existing working computer UI. The production target includes web; demo/development support alone does not meet that target. A static webpage can receive browser OAuth callbacks, but CORS, token lifecycle and safe credential storage differ. Direct browser support must be established separately for every provider. A service worker cannot bypass CORS or create native capabilities. Do not secretly introduce a hosted CalDAV proxy just to claim web parity. Full installed-platform parity and full server-free browser parity are different milestones. Track the unresolved browser authorization/CalDAV route explicitly; no platform may be marked production-ready with an unproven required provider. Escalate any conflict between full browser parity and the no-server constraint for a concrete decision.

Background refresh is opportunistic. Sync on launch/resume and when foreground; limit polling appropriately. A wall display can refresh while active, but mobile OS suspension prevents promising an unrestricted daemon. Cache reads and local task edits work offline; first provider connection requires internet. Offline launch means bundled assets and durable data, not merely a browser tab once opened.

## 8. Proposed repository layout

Logical boundaries first; migrate files incrementally rather than moving the entire repo before functionality works. A small workspace with ordinary scripts is sufficient; no new build orchestration system is justified yet.

```text
apps/
  client/                 React entry/composition and mobile native projects
  desktop/                desktop packaging/composition once selected
  website/                static project, downloads, docs and privacy pages
packages/
  domain/                 IDs, records, time/recurrence-scope types, invariants
  application/            account/calendar/task services and sync coordinator
  providers/
    google/ microsoft/ icloud/
  platform/               runtime interfaces and concrete adapters by target
  storage/                repositories, schema migrations and import/export
  ui/                     existing React views/design system, when extraction helps
  test-support/           sanitized fixtures and shared contract harnesses
backend/                  temporary Python baseline; explicit retirement stages
licenses/                 upstream notices and asset attribution
scripts/                  reproducible setup/build/test/release tools
```

Directory names are proposed, not an instruction to manufacture empty packages. Extract a package when its dependency boundary is meaningful. Keep one source of truth for models. Business logic must not depend on the file layout. UI and website can share brand assets/tokens without making the website bundle the calendar engine or private test fixtures.

## 9. Migration stages and completion gates

### Stage 0 — baseline and evidence preservation

Inventory the existing interfaces and direct API calls; preserve current tests, the working local app, data and secrets. Record versions and reproducible commands. Use the live provider-fix report as baseline, not the older failed audit alone. Establish which current artifacts are private before any public release. No credentials or real calendar screenshots in public fixtures.

**Exit:** a source map, regression inventory and recovery approach; no product behavior changed.

### Stage 1 — complete the shared service seams

Introduce composition, account commands, calendar commands and task commands. Route EventComposer, event time changes, AccountSetup, calendar controls and root composition through them. Keep HTTP/IndexedDB as initial implementations. Normalize IDs/revisions and errors at boundaries rather than rewriting all renderers together. Reuse existing date/time controls, editors, animation and layout code.

**Exit:** existing UI behavior and tests pass; React features no longer construct backend URLs or native SDK calls; mock/HTTP implementations satisfy the same contracts.

### Stage 2 — prove native foundations before broad porting

Bundle the existing UI in Android. Prove Google native authorization, Microsoft native authorization and iCloud authenticated CalDAV discovery/read/write on disposable events. Prove native HTTP headers/XML/custom verbs; credentials survive restart securely; local database transactions/migrations work. Keep the contracts free of mobile-only assumptions and validate them with a browser/dev adapter. A small desktop compatibility probe is optional if it exposes a concrete architectural risk; desktop packaging must not block Android or iOS. Build small provider slices under the intended interfaces, not throwaway duplicated engines.

**Exit:** new-device connections and restart succeed without the Mac backend; runtime choices and precise registration instructions recorded. If a provider/platform combination fails, report that specific gap before expanding the port. This phase needs interactive consent and possibly provider console configuration from Kelly.

### Stage 3 — port provider behavior in vertical slices

Proposed order: Google, Microsoft, then iCloud, because the latter has the broadest CalDAV/recurrence serialization surface. For each: discovery/read → command writes → recurrence/notes/revisions → reconciliation and offline queue. Carry corrected Python test cases into shared fixtures and independent expected outcomes. Fix ambiguous-create semantics as part of each write slice.

Route each account through exactly one active engine. Do not run old and new write workers against the same account concurrently. Keep old data/config for recovery; rollback requires reconciliation of new pending operations, not simply starting both engines.

**Exit per provider:** contract and live matrix passes, no pending synthetic writes, real remote cleanup verified, migrated runtime is authoritative. Python implementation becomes frozen reference until final removal.

### Stage 4 — local task and preference migration

Add versioned export/import and native repositories. Keep credentials out. Verify importing twice, corrupted export, newer local task conflict, completion history, ranks and date semantics. Make per-device data behavior clear in the UI/docs. Backups must recover tasks on a clean install.

**Exit:** Mac-origin tasks safely transferable to the tablet; independent edits are not advertised as automatically synchronized; app restarts offline with saved tasks/cache.

### Stage 5 — device acceptance and Python retirement

Run physical Android acceptance first, then full iOS acceptance, then macOS packaging/acceptance. Preserve the web regression suite in every stage and maintain an explicit parity/status matrix for all targets. Validate day/4-day/week/month/schedule, timezone changes, task completion, resizing, swipe/pinch/hold, anchored editors and accessibility. Disable the Mac backend and use a different network. Remove installed-app dependence on Python after every supported provider passes in the native engine. Retain the existing web development adapter until its replacement preserves the computer workflow; do not delete it merely because Android passed. Preserve required notices and useful tests, not an abandoned server product.

**Exit:** supported installed targets operate independently; source/setup docs match reality; backend retirement is deliberate and recoverable.

### Stage 6 — public project and release

Create the static project site, repository documentation and tagged downloadable artifacts. Site content: what Weekaboo does, real supported platforms, sample-data screenshots, installation/account setup, local-only task limitation, source/issues, privacy, terms, licenses, release notes/checksums. Google public-production OAuth requires an appropriate verified-domain homepage and policy links; complete that static content before public consent onboarding. No checkout, email capture, paid analytics, runtime generation API or mandatory account.

Use GitHub Releases for binary artifacts and Pages for lightweight static content. Official builds use protected signing credentials and injected provider configuration; source builds document replacement identities. Keep test and production Google projects distinct and obtain the necessary brand/scope verification. Do not request additional Gmail/contact scopes to simplify identity. Verify a clean checkout builds with example configuration, and that the released artifact installs/updates while retaining data. Resolve asset licensing and release-channel costs before publication.

**Exit:** a stranger can follow the documented supported route without contacting Kelly or deploying a Weekaboo service. Unsupported platforms are labeled honestly. Publishing/signing enrollment and any charges are separate concrete actions, not performed by this planning task.

## 10. Acceptance matrix

| Lane | Required evidence |
|---|---|
| Shared code | One UI/domain change reaches Android and desktop without duplicate implementation; dependency-boundary check |
| Native auth | New consent, cancel, denial, wrong account, multiple accounts, expired access, revoked grant, reconnect, cold return |
| Credential isolation | Account A cannot borrow account B's credential; disconnect does not purge another account or local tasks |
| Calendar correctness | Create/edit/delete, all-day/overnight, both DST directions, recurring exceptions/scope, read-only and disabled calendars |
| Concurrency | Stale update, intervening remote edit, remote deletion, lost successful response, repeated queued operation |
| Sync integrity | Paging, interrupted full sync, expired cursor, rate limits, range boundaries, restart mid-commit |
| Offline/local | Bundled launch, cache visibility, queued edits, task persistence, export/recovery, schema upgrade interruption |
| Provider details | Attendee display/status order, single meeting link, preserved Teams body, editable descriptions, maps links |
| UI | Compact cards reflect true times; no horizontal editor overflow; inline Anytime expansion; completed tasks retained; tablet gestures and keyboard |
| Distribution | Clean build, signed install/update, no dev endpoints/secrets, documented costs and platform limitations |
| Independence | Mac/backend stopped, different network, no requests to a required Weekaboo API |

Unit/contract fixtures must contain synthetic data. Live tests use uniquely named disposable events and no invited attendees unless specifically arranged. Verify cleanup at the provider and locally. Record candidate identity, commands and meaningful evidence. Existing connected accounts are not permission to mutate ordinary user meetings. Applicable independent-review instructions still govern auth/provider release candidates; a timed-out reviewer is not a pass.

## 11. Budget and public distribution

The app's runtime should have no billable Weekaboo infrastructure. OAuth app registration, consent verification and maintenance effort remain, even when the code is free. Do not assume higher usage cannot hit provider quotas; handle limits rather than automatically purchasing capacity.

| Item | Current plan / constraint |
|---|---|
| Public website | GitHub Pages for a public repository, within free service limits; custom domain is Kelly's intended expense |
| Binaries/source | GitHub Releases/repository; respect current asset and build-runner limits; no paid storage plan assumed |
| AI/giggles | Existing local assets only; no runtime ElevenLabs/Gemini/image-generation calls. Verify redistribution rights of generated audio before publishing |
| Android testing | Local signed APK install on existing devices; public distribution requirements reviewed separately |
| Google Play | US$25 one-time registration per current official documentation; optional route, not authorized spending |
| Android outside Play | Developer-verification rollout applies to distribution choices; official free limited distribution supports up to 20 devices. This is not a general unlimited public-release guarantee |
| iOS public distribution | Standard Apple Developer Program is US$99/year, region-dependent. Free Personal Team installs expire after seven days; not a practical general distribution strategy |
| Desktop signing | Select per target; notarization/certificates may introduce membership/certificate costs. Do not promise polished zero-cost distribution everywhere |
| Existing memberships | Kelly reports an Apple developer membership; a valid Mac Developer ID Application identity was found locally. Prefer this team; current membership access, iOS profiles and renewal budget still need validation. See user-dependencies.md |
| Hosted offering | Deferred. No provisioning, billing, authentication service or pricing work in this roadmap |

Sources and date-specific qualifications are in [platform reference notes](platform-reference-notes.md). If a platform needs spending beyond the domain, surface that concrete decision. Defer its public release or use an explicitly accepted existing entitlement; do not compensate by quietly introducing a hosted service. Zero server operating cost is feasible as a design target; zero cost for every vendor's preferred distribution channel is not established.

## 12. Remaining decisions, bounded validation and non-goals

| Question | When to resolve |
|---|---|
| Exact Android/iOS auth bridges and vault/SQLite plugins | Stage 2; assess maintained SDK support, open-source license, failure behavior and native testability |
| Desktop container and initial supported OS list | Third-priority delivery after Android/iOS; macOS first. Bounded earlier compatibility investigation only if needed; Windows/Linux not automatically certified |
| Pure-browser provider coverage | Separate bounded transport/auth tests; do not block standalone Android on unsupported browser CalDAV |
| Native distribution beyond the domain budget | Before enrollment/public releases; no implied approval |
| Public OAuth consent/publisher readiness | Before public account onboarding; maintainers handle configuration, ordinary users should not |
| Task sync/sharing | Future product decision; do not silently make it an MVP dependency or declare it solved |
| Account removal with pending edits | Before shipping queue: explain and offer retry/export/discard rather than silently lose work |
| Generated mascot/audio redistribution rights | Before public assets ship; current local samples alone are not licensing evidence |

Not current work: household tenancy, hosted user authentication, subscriptions, Nylas, a local home server, provider webhooks requiring our endpoint, paid telemetry, new AI features, unrelated UI redesign or reinstating Mantel's unused application structure.

Do not reopen the settled standalone direction solely because a hosted service would be easier to implement. Use the referenced research and existing evidence; re-check narrowly when selecting a concrete SDK/version, encountering conflicting behavior or approaching a release policy deadline.

## 13. Platform parity and user dependency tracking

Use [user-dependencies.md](user-dependencies.md) as the single checklist of setup actions requiring Kelly. Maintain per-platform status for every acceptance lane: not started, implemented, fixture-tested, real-device tested, distribution-validated, or blocked with a named dependency. A feature is not at parity because its shared source compiles. Distinguish browser, Android, iOS and macOS receipts; do not count the Mac-backed tablet preview as native evidence.

Equal product behavior means the same supported calendar/task operations, data fidelity and recovery guarantees. Native SDK glue, distribution format and OS scheduling opportunities may differ. Features dependent on an unresolved runtime must remain tracked, not silently disappear from the scope. Android readiness does not imply iOS readiness; native readiness does not imply browser CORS compatibility.
