# Open-source calendar audit — 9 September 2026

**Best demonstrated AI-assisted engineering process: Caspar / DinkyDash. Closest calendar foundation: Mike / Mantel. Broadest household application: Dennis / Tribu.** These are judgments about these repositories and the evidence available, not a ranking of the people’s overall abilities.

The original brief and subsequent feedback require an editable week calendar, multiple provider accounts, undated manually ranked tasks, Today focus independent of deadlines, task chips on the calendar, Android tablets now, and synchronized iPhone access later. Nylas and paid AI are optional; preserving personal/work separation and keeping operating costs small matter.

## Scope and reproducibility

Inspected source, schemas, provider transports, task services, security boundaries, CI definitions, recent commit history, and one substantial PR per project. Installed dependencies in isolated checkouts and ran tests. No real calendar accounts, household data, paid model calls, or external writes were used. No upstream issues or messages were sent.

| Project | Audited commit |
|---|---|
| Mantel | [`83537f72b80c0bd7d23222724b5996974ab6d3fa`](https://github.com/heyitsmiike101/mantel/tree/83537f72b80c0bd7d23222724b5996974ab6d3fa) |
| Tribu | [`585d37a2d351af1dd352e2ba42d36013165909f1`](https://github.com/itsDNNS/tribu/tree/585d37a2d351af1dd352e2ba42d36013165909f1) |
| DinkyDash | [`dae64e356d7dbaba7d9d27becfba984e5a96ebe1`](https://github.com/caspii/dinkydash/tree/dae64e356d7dbaba7d9d27becfba984e5a96ebe1) |

Checkouts: `/tmp/weekaboo-audit-20260909/{mantel,tribu,dinkydash}`. Python 3.12.13, Node 22.14.0; local disposable PostgreSQL 17 for DinkyDash. Tribu documents Python 3.13+, so its local test run on 3.12 is not a reproduction of its exact CI environment. Docker daemon was unavailable. Production Docker images, browser E2E, physical tablets/iPhones, real provider sync, and native app signing were not exercised.

## Fit for Weekaboo

| Requirement | Mantel | Tribu | DinkyDash |
|---|---|---|---|
| Interactive calendar | Week/month/day UI; event create/edit/delete | Calendar UI and own calendar store | Read-only agenda from ICS feeds |
| Existing Google accounts | Direct OAuth and bidirectional provider adapter | ICS subscription/import; no Google Calendar OAuth adapter found | ICS feed URL |
| Existing iCloud accounts | Direct CalDAV adapter | Serves its own CalDAV calendar to phone clients; external ICS feeds | ICS feed URL |
| Existing Outlook accounts | No Microsoft provider adapter found | External ICS feeds; no Microsoft Graph calendar adapter found | ICS feed URL |
| Undated tasks | Shared checklist items | First-class tasks with optional due date, assignment, recurrence | Rotating chores; no interactive task backlog |
| Manual task ranking | Item sort-order field, but no corresponding drag-to-rank UI found | Priority categories/newest/assignee sorting; no task rank field | Absent |
| Today focus separate from deadline | Absent | Absent | Absent |
| Same task on calendar and rail | Not the brief’s model | Not the brief’s model | Absent |
| Identity and phone access | Responsive/PWA; no user authentication, LAN/VPN model | User/family auth, scoped APIs, PWA, DAV | Self-hosted single-household mode; hosted mode has auth and family isolation |
| Offline edits with later sync | No client mutation queue found | No client mutation queue found; service worker does not provide offline task storage | No interactive task editing |
| Deployment burden | One container and SQLite | Frontend/backend, PostgreSQL and Valkey | Python and files for self-hosting; PostgreSQL for hosted mode |
| License at audited revision | MIT | MIT | MIT |

Tribu’s CalDAV support is materially different from connecting a user’s existing Google/Microsoft accounts. It lets phone clients connect to Tribu’s data. That is useful, but does not remove the provider-aggregation work Kerry needs.

Tribu’s dedicated `/display` surface is deliberately read-only; the normal authenticated UI supports editing. Native-app documentation points to a separate `itsDNNS/tribu-app` repository that could not be fetched (“Repository not found”). This may be private or unavailable; no conclusion about native readiness is justified.

Sources: [Mantel models](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/backend/app/models.py), [Mantel provider contract](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/backend/app/services/providers/base.py), [Tribu tasks](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/backend/app/core/task_service.py), [Tribu task sorting](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/frontend/hooks/useTasks.js), [Tribu native readiness](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/docs/native-app-release-readiness.md), [DinkyDash calendar reader](https://github.com/caspii/dinkydash/blob/dae64e356d7dbaba7d9d27becfba984e5a96ebe1/dinkydash/calendars.py).

## Engineering findings

**Mantel: confirmed loss of pending provider edits/deletions during full resync — high priority before adoption.** Import a Google event, edit or delete it through the real local API, then expire the incremental sync cursor before the push completes. Recovery deletes all rows whose origin is the provider, including pending changes, and reimports the older remote event. An edited title reverts; a pending deletion becomes a live synced event again. The existing tests cover preserving newly created local-origin events, but not pending edits to imported provider-origin events. The recovery code is shared by providers; the independent reproduction used its fake Google transport.

Both independent regression cases fail against the audited revision. [Recovery code](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/backend/app/services/sync_engine.py#L125), [local probes](mantel_regression_probes.py), [failure output](evidence/mantel-audit-probes.log). A fix needs to preserve pending state across cursor resets and failed refreshes, not merely preserve events originally created locally.

**Mantel: no authentication plus wildcard CORS is an unsuitable default for the intended broader app.** `cors_origins` defaults to `*`, and middleware permits all methods/headers. A local probe confirmed a preflight from an arbitrary origin is granted permission to PATCH events. A reachable client can use the API without authentication, intentionally. Browser-based exploitation depends on local-network permission, mixed-content and browser restrictions; this audit establishes the API policy, not a successful cross-network browser exploit. Restrict origins and add authenticated, scoped access before broadly accessible hosting. LAN/VPN deployment is the author’s intended model. [Defaults](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/backend/app/config.py), [middleware](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/backend/app/main.py).

**Mantel: good provider separation, but substantial lifecycle debt.** A shared sync engine delegates provider translation and transport; tests exercise provider serialization instead of mocking it away. However, schema upgrades are additive-only, single-occurrence editing is limited, and failed pushes have no retry ceiling. These constraints are documented and complicate evolution into a multi-user app. [Engineering notes](https://github.com/heyitsmiike101/mantel/blob/83537f72b80c0bd7d23222724b5996974ab6d3fa/AGENTS.md).

**Mantel: contradictory iCloud verification claims.** Current engineering notes and [PR #2’s body](https://github.com/heyitsmiike101/mantel/pull/2) say real iCloud was not yet tested. The [merge commit](https://github.com/heyitsmiike101/mantel/commit/8db32ebbd31093d1cdbc3bd887c2e3ee2721323e) explicitly reports create/update/delete/all-day round trips on a live four-account instance including iCloud. Treat this as stale documentation and an author-reported live trial, not proof the adapter never worked or independently verified reliability.

**Tribu: stronger application boundaries and task modeling.** REST and DAV task changes go through one service that owns permissions, recurrence, completion effects, and webhooks. Family membership and explicit task scopes are enforced server-side. Dedicated display tokens are revocable and distinct from user sessions. It has versioned Alembic migrations rather than ad hoc schema patching. Its scope also includes meals, rewards, recipes, school, contacts, notifications and more, creating a much larger maintenance surface than this brief requires. [Task service](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/backend/app/core/task_service.py), [auth dependencies](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/backend/app/core/deps.py), [DAV integration tests](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/backend/tests/test_dav_tasks.py).

**Tribu: release checks cover less than the available test suite.** Image publishing waits for frontend unit tests and a backend job that explicitly runs only `test_cors_headers.py`, `test_mobile_auth.py`, and `test_oidc_flow.py`. Browser E2E runs in a separate workflow, but the publishing job does not depend on it. The omitted task/DAV and household tests can therefore fail without that image job itself being blocked. This is a pipeline gap, not a claim that the omitted tests currently fail. [Backend workflow](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/.github/workflows/backend-tests.yml), [image workflow](https://github.com/itsDNNS/tribu/blob/585d37a2d351af1dd352e2ba42d36013165909f1/.github/workflows/docker.yml).

**DinkyDash: strongest evidence of testing real failure modes.** Both file and PostgreSQL stores run the same behavioral contract. Concurrent settings/refresh tests ensure hidden or removed calendar events cannot be restored by an in-flight fetch. Transport tests run a local TLS server and simulate changing DNS responses to exercise actual connection pinning and hostname checks. Other tests cover household isolation, token/log hygiene, and concurrent AI spending limits. Those checks all ran successfully locally. [Storage contract](https://github.com/caspii/dinkydash/blob/dae64e356d7dbaba7d9d27becfba984e5a96ebe1/tests/test_store_contract.py), [publication race tests](https://github.com/caspii/dinkydash/blob/dae64e356d7dbaba7d9d27becfba984e5a96ebe1/tests/test_calendar_publication.py), [TLS tests](https://github.com/caspii/dinkydash/blob/dae64e356d7dbaba7d9d27becfba984e5a96ebe1/tests/test_feed_transport.py).

**DinkyDash: a reproducibility wrinkle even here.** Installing only documented `requirements-dev.txt` produces 10 failures from missing `psycopg` imports, with 643 passes and 313 skips. Installing cloud dependencies fixes this: without PostgreSQL, 659 pass and 307 skip; with PostgreSQL, all 966 pass. CI’s “self-hoster” test step runs after cloud dependencies were installed, so it does not reproduce a clean self-hoster environment. This is a test/dependency-isolation gap; it does not establish that the self-hosted application is broken. [CI](https://github.com/caspii/dinkydash/blob/dae64e356d7dbaba7d9d27becfba984e5a96ebe1/.github/workflows/test.yml), [initial run](evidence/dinkydash-pytest.log).

## Who appears strongest at AI-assisted development?

1. **Caspar: strongest demonstrated verification discipline in this sample.** The recent history explicitly attributes substantial work to Claude, but the engineering evidence is more useful than attribution counts: real database tests, adversarial transport tests, race-condition reproductions, reproducible Conductor setup, and concrete PR validation. GitHub’s live branch rules confirmed required `pytest` and `gitleaks` checks plus PR-only normal merges. Approvals are set to zero, and the author documents administrator bypass. No separate approving review was present on sampled PR #93. This does not demonstrate an independent cross-model review process comparable to Kelly’s pipeline.
2. **Dennis: strongest broad application engineering.** Substantial integration and UI coverage, shared domain logic, migrations, deliberate family/device authorization, and active dependency maintenance. The main reservation is that the release gate omits most backend tests. The separate native repository is unavailable for inspection. Sampled PR #460 has detailed test claims but no separate GitHub review; those claims are distinguished from tests run in this audit.
3. **Mike: promising calendar specialist with weaker demonstrated release assurance.** Sensible provider boundaries and many useful regressions, but an important pending-write case is missing, the default API policy needs redesign for wider access, and documentation is stale. GitHub reports `main` unprotected. This ranks the current project evidence, not his cybersecurity career.

All three have explicit Claude attribution in inspected history. Trailer counts cannot tell us what fraction was generated, how carefully it was reviewed, or who supplied the architectural insight. README quality, elaborate agent instructions, and test counts alone are insufficient evidence. No broad “AI slop” label is warranted from this audit.

## Local verification

| Project | Results |
|---|---|
| Mantel | Existing backend: 340 passed. Frontend: 113 passed. Production frontend build passed. Independent audit probes: 3 failed, reproducing two pending-write loss cases and permissive CORS. |
| Tribu | Backend: 712 passed (SQLite, Python 3.12). Frontend: 494 passed. Production frontend build passed. |
| DinkyDash | 966 passed with disposable PostgreSQL 17, no skips. Clean dev-only dependency run had 10 missing-driver failures as described above. |

`npm audit` found three Mantel advisories, all in dependencies marked development-only in its lockfile. Tribu had one development-only `js-yaml` advisory and a runtime `sharp`/libheif advisory. These are dependency alerts, not confirmed exploitable application paths; image handling reachability and remedies need review before adoption. Exact reports are in `evidence/`. Python dependency vulnerabilities were not scanned.

## Recommendation

Keep the custom Weekaboo interaction model. None of these projects implements its core combination of manual ranking, independent Today focus, and task chips on the calendar.

Study Caspar’s tests and failure-handling patterns first. Use Mantel as the leading reference for provider integration and week-calendar behavior, contingent on fixing the reproduced sync bug, verifying real-account behavior, and designing phone authentication. Choose a Tribu fork only if its larger household suite becomes desirable; otherwise it imports substantial scope while leaving external-provider aggregation to build. DinkyDash would require creating most of the interactive calendar/task application, despite being the strongest process example.

A bounded next adoption experiment would connect disposable Google and iCloud calendars, test pending edits through expired sync cursors and connectivity loss, and validate the resulting calendar plus Weekaboo tasks on one tablet and one iPhone. That would answer more than adopting a whole repository based on its author’s résumé.
