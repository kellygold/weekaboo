# Supplied product brief

Source: the original private product-brief document. Text extracted on 2026-09-09; original DOCX retains table formatting.

Wall Calendar / Life Dashboard

Product brief & engineering handoff

Status: Discovery / prototype. Primary hardware: Lenovo Tab P11 Gen 2 (Android 14, 11.5-inch 2000×1200 120 Hz, 6 GB / 128 GB). Secondary target: Samsung Galaxy Tab A11+ class Android tablet.

1. Product intent

Build a touch-first, always-available personal life dashboard that combines a genuinely good calendar with lightweight task management. It should work first as a useful appliance for one person, while leaving a clean path to multi-user / couple use, multiple calendar providers, smart-home integration, and presence-aware display control.

The project exists because Google Calendar is already good enough for the calendar-only prototype, but its task UX does not match the desired mental model. A task should be allowed to exist without a date, deadline, or scheduled time.

2. Product principles

Useful before custom software: The current MVP is stock Android + Google Calendar. Custom development should only replace parts that materially improve the experience.

Tasks are not calendar events: A task may simply mean “this should get done.” Dates, deadlines, reminders, and scheduled time are optional metadata.

Views are not the data model: Manual ranking, lists, Kanban, Today, Upcoming, and Calendar are different projections over the same underlying tasks.

Glanceable first, interactive second: The wall surface should answer “what is happening?” and “what matters?” in seconds, then allow touch drill-down.

Provider-agnostic where useful: The UI should not care whether an event originated in Google, Microsoft/Outlook, or iCloud.

Local-first appliance behavior: The device should remain useful with minimal cloud complexity; sensitive credentials and network access should be narrowly scoped.

3. Validated user needs

Primary user

Calendar usage is primarily Google. The current desired default is a full-screen week view. Personal task management is best represented as a ranked backlog: there are usually too many possible tasks, and the useful question is which three to five matter most today. Examples such as “buy Brita filters” or “schedule a barber appointment” should not require artificial deadlines.

Secondary user / gift use case

The second user explicitly liked the idea of syncing calendar information and ticking off to-do lists. Her personal calendar workflow appears centered on Apple Calendar on iPhone, with some Outlook usage; work uses Google Calendar. She prefers a personal-only default but may benefit from an optional Work toggle or work-hours mode. Do not assume her task-management preferences match the primary user's.

4. MVP and staged scope

Stage

Calendar

Tasks

Device behavior

0 — current prototype

Native Google Calendar; multi-Google-account login

Google Tasks only for evaluation

Manual wake / plugged-in Stay Awake

1 — custom MVP

Week view; Google calendar integration

Own simple task store; create, complete, reorder

Touch-first kiosk/PWA or APK

2 — personalized

Provider aggregation; Personal / Work filters

Lists/sections, optional due dates, recurrence

Presence-aware wake/sleep

3 — broader product

Google + Microsoft + iCloud; shared calendars

Multiple views: ranked, list, Kanban, Today

Home Assistant / shared household integrations

5. Task model

Use an Asana-like underlying model: the task is primary and metadata is optional. Do not make a due date mandatory and do not silently assign “today” when a task is created.

Field

Meaning

id

stable UUID

title

required

completed

boolean

rank

manual ordering / priority; core for ranked view

section_or_list_id

optional grouping

assignee_id

optional; useful for shared/couple use

due_at

optional deadline; not the same as scheduling

scheduled_start / scheduled_end

optional time actually allocated on calendar

recurrence

optional

notes

optional

subtasks

optional

source / external_id

optional integration metadata

created_at / updated_at / completed_at

audit/sync fields

6. Task views

Ranked backlog: Primary user's default. Drag-and-drop order is priority. Show only the top several tasks on the wall; expand for the full backlog.

Lists / sections: Simple named collections for users who think in grocery, personal, work, errands, etc.

Today: A temporary focus selection, not necessarily a due date. Unfinished tasks can fall back to the ranked backlog.

Due / upcoming: For users who actually use deadlines.

Kanban: Optional projection for users who care about state. Do not make it the canonical task structure.

7. Calendar behavior

Default wall view should be a dense, readable Week view with minimal chrome.

Support multiple accounts/calendars with simple visibility toggles.

For multi-provider users, expose high-level Personal / Work toggles while allowing per-calendar configuration in Settings.

Work visibility should be opt-in. A future work-hours rule may change the default visibility automatically without deleting or moving events.

A task can optionally be scheduled into time. Scheduling and deadline are separate concepts.

Complex event editing may initially deep-link to the provider/native app rather than recreating every calendar edge case.

8. Integration options to evaluate

Calendar providers

Option A — Google APIs directly: best for the primary Google-only user; fewer dependencies and potentially simpler cost model. Option B — Nylas: attractive when normalizing Google, Microsoft/Outlook, and iCloud/CalDAV for the secondary user and future multi-provider users. The implementation should hide provider specifics behind an internal CalendarProvider interface so this choice can change.

Tasks

Do not require Google Tasks. The preferred starting point is an application-owned task model because Google Tasks currently imposes date-centric UX and sorting constraints that do not match the desired ranked-backlog behavior. A simple database is sufficient.

Task storage candidates

Web/PWA: hosted database (Postgres/Supabase/Neon/etc.) plus a small API; easiest for multi-device sync and shared tasks.

Native APK: Room/SQLite for local data, with a small sync service/backend when cross-device sharing is added.

Hybrid: web application as the product UI, packaged later as a Trusted Web Activity/WebView shell only if Android-specific device control is needed.

9. APK vs web/PWA decision

Consideration

Web / PWA

Native Android APK

Speed to build

Excellent; familiar web stack

More learning/setup

Calendar/task UI

Excellent

Excellent

Multi-device deployment

Excellent

Good

Offline/local DB

Good with IndexedDB; backend recommended for sync

Excellent with Room/SQLite

Camera/presence

Possible but constrained by browser lifecycle/permissions

Best control

Screen wake/sleep / kiosk

Limited / browser-dependent

Best control via Android APIs/device-owner approaches

Background services

Constrained

Much stronger

Recommendation

Best first product UI

Likely needed for appliance/device-control layer

Suggested architecture: build the core product as a responsive web app/PWA first, with a clean API/backend. If presence sensing, reliable kiosk behavior, wake/sleep control, or other Android lifecycle requirements become important, add a thin native Android shell/service around the web UI or move the client native. Do not commit to a full native rewrite before testing the Android-specific requirements.

10. Presence-aware display / battery

The tablet may not have convenient continuous wall power. Therefore a long-term solution should minimize screen-on time. The P11 uses an IPS LCD, so dark theme itself is not a major battery saver; backlight brightness and screen-off time matter much more.

Prototype: manual wake/sleep or Stay Awake while plugged in.

Desired: screen sleeps when nobody is nearby and wakes when a person approaches.

Investigate low-duty-cycle front-camera person/face detection, but avoid continuous high-frame-rate recognition.

Prefer generic presence detection over identity recognition unless identity creates a real product benefit.

If native Android background-camera restrictions make this awkward, evaluate external Home Assistant presence (PIR/mmWave) as an alternative.

Measure real battery drain with screen on vs asleep before optimizing further.

11. Security / appliance posture

Eventually place tablets and other IoT devices on an isolated IoT VLAN/SSID.

Deny IoT-initiated access to trusted LAN by default; allow outbound internet as required.

No permanent SSH/ADB/remote-management service unless there is a demonstrated need.

Keep the application surface small; avoid unrelated browsing and unnecessary apps.

Use read-only or least-privilege credentials where possible.

For a custom backend, never embed provider client secrets in the Android/web client.

12. UX sketch

Landscape tablet default: approximately 65–75% calendar and 25–35% tasks. Calendar shows the current week. Task rail shows only the highest-value items by the active view. The screen should remain readable from several feet away.

Top bar: Today, previous/next week, Personal / Work / All filters, Settings.

Calendar: seven-day week, compact event cards, clear current-day treatment.

Task rail: large check targets, drag handles, quick-add, visible top 5–8 items, “more” affordance.

Task details: optional section/list, due date, scheduled time, recurrence, notes; none required except title.

Potential high-value gesture: drag or action “Schedule” to allocate a task onto the calendar without converting its due date.

13. Non-goals for the first build

Do not recreate every Google Calendar feature.

Do not build a full Asana competitor.

Do not build AI scheduling before the basic interaction model is proven.

Do not require Home Assistant.

Do not require custom ROM/root/bootloader changes.

Do not make work calendars visible by default for users who asked for personal-only.

Do not force dates, priorities, projects, or assignees during task creation.

14. First engineering spike for Codex

1. Create a responsive landscape-first prototype at 2000×1200 logical target proportions.

2. Implement mock week-calendar data and a task rail backed by a local in-memory/SQLite-like abstraction.

3. Implement task create, complete, edit, and drag-to-rank with no required date.

4. Add Personal / Work / All calendar filters using mock provider/account metadata.

5. Define CalendarProvider and TaskRepository interfaces before wiring real APIs.

6. Evaluate Google Calendar API direct integration for the primary account.

7. Evaluate Nylas separately for Google + Microsoft + iCloud aggregation; document auth/onboarding constraints and expected cost.

8. Choose backend/storage only after deciding whether shared/multi-device task sync is in MVP.

9. Run the prototype full-screen on the Lenovo P11 and validate touch target sizes, readability, and week density.

10. After UI validation, spike Android-specific screen wake/sleep and presence detection. Use the result to decide PWA + native shell vs full APK.

15. Open questions

Should the first custom build be Google-only or immediately support Kerry's multi-provider calendar situation?

Is Nylas worth the dependency/cost versus provider-specific integrations?

Should task data be cloud-first from day one or local-first with sync later?

What is the minimum useful shared/couple model: shared tasks, shared lists, shared calendars, or all three?

Does the Android browser/PWA remain alive reliably enough for a wall appliance?

What Android APIs/permissions are required for reliable presence-triggered screen wake/sleep on this exact tablet?

Can device-owner / kiosk mode materially improve reliability without making setup painful?

What battery life is achievable at realistic brightness and screen-on duty cycle?

16. Definition of a successful v1

A user can mount the tablet, connect calendar account(s), see a useful week at a glance, capture an undated task in seconds, reorder tasks by importance, check them off, optionally schedule one into time, and leave the device running as an appliance without needing to think about the underlying calendar provider or task database.
