# Historical cross-platform architecture proposal

> Superseded on 11 September 2026 by the [standalone plan](../cross-platform-plan.md). Retained to explain the earlier alternative; not an implementation instruction.

10 September 2026. Planning only: no deployment, native project, authentication service, or task migration is implemented by this proposal. This consolidates the deployment alternatives in product-direction.md; it does not turn either alternative into an accepted decision.

## Product constraints

- Maintain one React UI and shared product behavior for desktop web, Android tablets, and eventually iPhone. Do not create an Android-only fork.
- Kerryn's tablet must work without a separate computer running at her house.
- Tasks, including scheduled blocks and completion history, should follow the same person across devices. Sharing with another person must be explicit.
- Retain the current design and direct Google, Microsoft and iCloud integrations. Keep the project suitable for open-source distribution.
- Keep costs and operational overhead modest. Zero hosted infrastructure has not been established as a hard requirement.
- Unresolved: whether computer support must work in an ordinary browser without installation, or an installed desktop app is acceptable.

## Recommended baseline, subject to the computer-access decision

One React application, an installable web build and Capacitor mobile packages, using one authenticated shared backend. Retain the existing Python provider engine rather than porting and maintaining another implementation. The tablet requires internet for synchronization, but no Mac or home server. Cached data and a durable local command queue support offline use.

A repository containing React plus one Python service is one product codebase. Cross-platform reuse does not require converting every component to one language. Native build projects and small SDK adapters are unavoidable; duplicate product screens, task rules and provider engines are avoidable.

A completely service-independent installed app is a different baseline. If that becomes a requirement, first prove on-device Google authorization, iCloud CalDAV read/write and durable storage on Android. Then choose a portable provider engine and retire the old implementation provider by provider; do not grow independent Python and mobile integration stacks indefinitely. A pure browser cannot inherit native network or credential-storage capabilities merely because the same React code is used. Multi-device synchronization still needs a transport and access-control design.

## Shared boundaries

| Layer | Ownership |
|---|---|
| React UI | Views, cards, editors, animation, touch/mouse/keyboard interaction; no provider-specific authentication URLs or hardcoded backend paths |
| Product/domain services | Tasks, time blocks, completion history, recurrence scope, calendar commands, account connection and capability reporting |
| Client data layer | Local cache, pending operations, retries, migration and conflict presentation |
| Runtime adapters | Browser versus native authentication handoff, storage, links, lifecycle and optional device features |
| Shared backend in recommended baseline | Identity/access checks, canonical task data, provider credentials, durable provider-write queue and calendar synchronization |

Current seams are incomplete: src/domain.ts CalendarProvider has reads only; EventComposer, AccountSetup, CalendarControls and main.tsx call calendarRequest directly. TaskRepository exists, but main.tsx constructs IndexedDBTaskRepository directly. Introduce one composition point and injected CalendarService, AccountService and TaskRepository contracts before changing runtimes. Keep current HTTP and IndexedDB implementations working during extraction.

Use opaque app identities and explicit provider references rather than making SQLite integer primary keys part of a portable UI contract. Separate timed instants plus named time zones from date-only tasks/all-day events. Keep a stable task ID when it gains or loses a time block.

## Data and identity

In a hosted deployment, signing into Weekaboo and connecting a calendar are separate actions. Associate connected accounts with their owner; enforce access checks on every read/write and OAuth attempt. Model a person's task lists separately from lists they intentionally share. Personal/Work grouping is a view filter, not an access-control boundary.

Task synchronization must include IDs, revisions, ordering, scheduled blocks, deadlines, completion date/history and deletion tombstones. Queue durable operations with stable operation IDs; retry without duplicating work. Conflicting edits must be surfaced or resolved by an explicit policy, rather than silently replacing newer data. Calendar-provider retry and revision behavior remains part of the same correctness contract.

Migrate existing IndexedDB tasks after the destination identity/list is known. Preserve task IDs and history; make import idempotent and retain the source until acknowledgment. A browser refresh or a different port must not silently create a second copy.

Keep view density, zoom, pane sizing and similar device preferences local. Decide explicitly which calendar preferences should follow a person. Do not put provider secrets into a generic task-sync payload or bundle server OAuth secrets into an APK.

## Platform behavior

- Web: hosted HTTPS, browser authentication, IndexedDB cache, service-worker shell caching. Ordinary browser access uses the shared service in the baseline above.
- Android: bundle the same React build with Capacitor. Use narrow native adapters only where browser behavior is insufficient. No URL pointing back at a development Mac.
- iPhone: reuse the same shared layers; validate mobile UI, authentication return, storage and background limits separately. Native shortcuts/intents can later call the same task command service.
- Background work is opportunistic when apps are suspended. Sync on launch/resume and use foreground refresh for an always-on display; do not promise an unrestricted mobile background polling loop.

A web OAuth callback and native authorization flow are different runtime contracts. For the hosted baseline, design each handoff around the shared service and correct registered platform clients. For device-side integration, use supported native provider authorization rather than embedding the development web client's secret.

## Implementation sequence

1. Settle the deployment baseline and computer-access requirement. Keep the LAN preview for interaction testing only.
2. Complete/inject the service boundaries without changing visible behavior. Run existing regression tests.
3. Implement identity, ownership and shared task persistence/sync for the hosted baseline, with safe import of existing tasks. Prove two-device consistency and isolation between people.
4. Deploy a private HTTPS environment with persistent storage and correct OAuth callbacks. Test fresh Google/Microsoft/iCloud connection, not only already-connected accounts.
5. Add install/offline behavior and an Android Capacitor build consuming the same service contracts. Prove the tablet works with the Mac switched off.
6. Validate iPhone web first, then native packaging and OS integrations when justified. Keep a desktop-native build optional unless it is part of the accepted computer-access requirement.

If zero hosted service is chosen, replace steps 3–4 with an on-device provider/storage proof and an explicit cross-device sync design before porting production integration code.

## Acceptance scenarios

- One shared UI/domain change appears in web and Android builds.
- A fresh tablet installation connects each supported provider without localhost redirects or a Mac.
- A task created on the computer appears on the tablet; completion and scheduled placement agree on both.
- Offline edits survive restart and reconnect without duplicates; stale edits and remote deletions follow a tested policy.
- Different people's private calendars/tasks remain isolated; deliberate shared lists work.
- Returning from provider consent and resuming a suspended app works on actual devices.
- Desktop/browser support continues throughout migration; provider contract tests are reused, not replaced by mocks of the adapter being tested.

## Primary references

- Capacitor runtime and platform plugins: https://capacitorjs.com/docs
- Native HTTP transport: https://capacitorjs.com/docs/apis/http
- Google Android API authorization, separate from sign-in: https://developer.android.com/identity/authorization
- Google installed-app OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
- PWA architecture: https://web.dev/learn/pwa/architecture
- Android periodic background-work constraints: https://developer.android.com/reference/androidx/work/PeriodicWorkRequest
