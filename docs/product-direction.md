# Weekaboo — product direction

Updated 11 September 2026 from Kelly's feedback. This supplements the original supplied brief; where priorities differ, use this document.

## Who it is for

Kerryn is the first calendar customer: an Android tablet now, potentially her iPhone later. Kelly can keep using native Google Calendar; Weekaboo's separate, undated tasks are useful to him without replacing his calendar app. Do not assume both people need every feature or the same calendar setup.

Weekaboo is the current working name. Keep the calm, readable design, with a more playful identity and small purposeful transitions.

## Current interaction decisions

- A compact calendar-group menu defaults to Personal. A drawer groups calendar visibility checkboxes by account; calendar settings assigns colors and Personal/Work/custom groups.
- The task panel slides away and returns without losing its view, input draft or width. Resize by dragging the vertical divider between panels, with keyboard support; there is no range slider. Honor reduced-motion preferences.
- Tasks picked for today appear both in the task list and in an “Any time” calendar row. Completed tasks remain on the day they were completed, checked and struck through, even when completed from an undated backlog. These are projections of the same task records, not provider events. Restoring removes the completion entry and restores its pending Today chip if it is still focused today.
- Quick-add in For today sets today's focus date; quick-add in Backlog leaves it unset. Neither creates a deadline or a scheduled time.
- Calendar chips open task details. Pending Today focus expires at the next local date; unfinished tasks remain in the backlog. Completed entries remain as history on the completion date.
- Task focus is independent of calendar-account visibility filters. Work calendars stay opt-in. Future work/personal task filtering needs explicit task ownership/category design.

## Installation and cross-platform direction

The [standalone implementation plan](cross-platform-plan.md) is authoritative for architecture, sequencing, budget and release gates. Maintain one shared React application and TypeScript provider/domain engine, with narrow native runtime adapters. Deliver native Android first, iOS second, then a macOS app/DMG. Android and iOS are application-submittable builds, not only PWAs. Preserve the browser version and pursue production behavior parity across targets; track its unresolved standalone provider access separately. Android tablets must operate without a Mac or home server. iPhone and installed desktop targets reuse the same core; pure-browser provider parity requires separate validation.

Users connect calendar accounts on each device. Provider services synchronize their calendar events. Weekaboo tasks and device preferences remain local until a separate synchronization design is selected; do not imply connecting the same account transfers them. Preserve local data and provide explicit export/import.

No required hosted application, Weekaboo login, household tenancy or paid service is planned now. The public `weekaboo.app` website is a static project/download/source site. Kelly's operating-cost target is the domain only; native distribution cost constraints are recorded in the plan. A future optional hosted offering must not drive this implementation.

## Phone experience and future capture

Adapt the same UI for phones: agenda/day and quick task capture, with broader views available. Keep viewport fitting and touch behavior intentional; do not merely shrink a seven-column wall display.

Native shortcuts and optional natural-language capture should call the shared local task command service. They must not require an authenticated hosted task service. iPhone App Intents/Shortcuts are future work after native packaging and its distribution path are established; no shortcut feature is implemented by this plan.

## Natural-language task capture — planned

Keep the simple input as the default. Add optional interpretation of typed or dictated text, returning a structured draft before saving. This is planned; there is no AI parser or speech service in the prototype.

| Input | Intended task data |
| --- | --- |
| Buy Brita filters | Title only; no date, focus period or allocated time |
| Get a plant pot today | Title plus today's focus date; no invented deadline |
| Get a plant pot this week | Title plus a week focus period; no invented deadline |
| Buy Brita filters by 19 September | Title plus a deadline resolved to a concrete date in the user's timezone |
| Do XYZ this week, by Saturday | Independent week focus and Saturday deadline |
| Buy Brita filters by this weekend | Show the interpreted deadline as a real date; clarify whether the user means before the weekend or by its end when needed |

Supply the parser with a reference date, locale and IANA timezone. Distinguish focus periods, deadlines, reminders and scheduled time blocks. Dates remain local calendar dates unless a time is explicitly supplied; scheduling must not overwrite a deadline. “This week” needs a future focus-period field instead of overloading dueAt or today's focusDate.

Use a small CaptureTaskDraft result (title, optional focus period, optional deadline/time block, interpretation notes and unresolved ambiguity), then validate it before applying the same create-task command used by simple input. Let the user edit the interpretation; the AI should not write directly to calendars. Leave dictation and language interpretation separate: native keyboard dictation can be the initial speech input.

## Calendar-provider choice

Use the existing direct Google, Microsoft and iCloud behavior as the migration baseline. Port it into the shared engine according to the canonical plan. Nylas is not a current dependency or workstream. Earlier provider comparisons in [integration-options.md](integration-options.md) are historical.

An Apple Calendar client may contain accounts hosted by several providers; inspect Kerryn's actual account inventory rather than equating the client with iCloud. Support multiple accounts and subcalendars without carrying over Mantel's ownership/claiming or local Family seed model.

## Still open

- Kerryn's actual provider/account inventory for native onboarding acceptance.
- Whether either user needs their own tasks synchronized to a phone immediately, and whether couple sharing is wanted separately.
- Default interpretation of “by this weekend.”
- Phone information density, preferred task view and native features that would justify packaging.

These are future product decisions; use the canonical plan for implementation dependencies. AI interpretation is optional and must not create a maintainer-paid runtime API dependency.
