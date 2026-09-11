# Weekaboo integration direction

Historical backend-extraction record from 9 September 2026, annotated 11 September. The extraction is complete. The [standalone plan](cross-platform-plan.md) now governs the next architecture; this record does not prescribe retaining Python in installed apps.

## Implemented

Weekaboo has its own React UI, task repository, Python API, database schema, scheduler, configuration and account onboarding. Selected Mantel provider, recurrence and event-validation components were adapted into `backend/weekaboo`; the original application's UI and structure are not dependencies.

The local cutover imported four connected accounts, 15 provider calendars and 5,182 cached event records, with no pending writes at migration. Credentials were re-encrypted under a fresh key. The original Mantel database/configuration were preserved and its server stopped. Subsequent synchronization can change those counts.

Google and iCloud setup, per-calendar syncing, event editing, recurring-event handling and pending provider writes are available through Weekaboo. Calendar/account management lives exclusively under Connected calendars; the cog handles appearance. The local service is not an internet-facing multi-user product.

## Installation requirement still outstanding

Kerryn must be able to use an Android tablet without another computer running a server at her house. The current Python backend completes the local integration extraction; it does not satisfy standalone tablet installation. Device-side secure storage and direct provider integration are now the selected direction and still need implementation. Future iPhone access and shared task synchronization must be considered in that work.

## Scope boundaries

No local Family seed, household ownership/claiming, dashboard, weather, photos, Home Assistant or Mantel settings handoff. Real provider calendars named Family remain real calendars and are not renamed or removed.

Tasks and group definitions remain browser-local. A later controlled live matrix verified provider reads and writes on disposable events and cleaned them up; see the 10 September fix report (private local evidence: `output/provider-fixes/report.md`). No APK, external deployment, maintainer message, public fork or PR was published.
