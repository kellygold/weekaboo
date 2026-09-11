# Backend extraction review — 9 September 2026

A bounded read-only Claude cross-lab review examined an isolated snapshot of the extracted backend and importer. It found defects; this is not a claim of an unconditional clean review or release approval. Raw local review evidence is in ignored `data/backend-cross-lab-review.jsonl`.

## Triage

- Confirmed full-resync reconciliation could retain deleted remote events originally created locally, or change cached event IDs. Fixed by fetching the replacement window before applying changes, reconciling in place, preserving pending writes and cached history outside that window. Regression tests cover stable IDs, deletion and pending edits.
- Unsupported-provider errors could interrupt all-account processing. Registry failures now use the provider error type handled per account.
- OAuth network failures could escape as a server error. HTTP transport failures now redirect with a sanitized retry message; a successful connection with failed discovery remains connected and reports discovery separately.
- Importer schema/default assumptions were too implicit for other source versions. The audited source was successfully migrated; the importer now rejects unsupported missing required columns explicitly.
- Importer failure between configuration creation and database installation could leave a partial installation. Normal exceptions clean up newly created configuration. Abrupt process termination still requires recovery using the retained staged database and encryption key; the error explains this rather than overwriting credentials.

## Validation and limits

164 backend tests pass, including provider/recurrence suites, OAuth browser binding, disabled/read-only calendar boundaries and migration preservation. The browser suite has 20 passing tests, including stubbed event CRUD and account/calendar configuration. Live migrated calendar reads work. Provider writes were not exercised against real user events. Follow-up fixes have regression coverage but were not given a second independent review.

The service remains a single-user, loopback development application. Standalone Android packaging, cross-device task sync and public deployment are outstanding. Importer's alternate destination option is for isolated migration testing, not a runtime configuration switch; runtime uses `DATABASE_URL` or the app's default path.
