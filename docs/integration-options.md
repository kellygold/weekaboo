# Historical integration options — 9 September 2026

> Superseded for current implementation. These notes describe early experiments, outdated implementation status and historical pricing, not the current plan. Google, Microsoft and iCloud integrations now exist. Follow the [11 September standalone plan](cross-platform-plan.md) and [platform reference notes](platform-reference-notes.md). Nylas and a mandatory hosted sync service are not selected. Do not repeat this old setup sequence or interpret its untested-state statements as current.

Follow-up: [current product direction](product-direction.md) makes Kerry the primary calendar user. Kelly can keep native Google Calendar. Nylas is an optional implementation choice for her provider mix, not a requirement; account inventory should drive the decision. Phone sync and potential iOS/Android packaging are now explicit future needs.

## Recommendation for the next spike

Keep the web UI and owned task model. Use a real calendar adapter after deciding whose accounts go first. Google direct is the smaller dependency choice for Google-only usage; Nylas deserves a practical trial if Kerry needs iCloud and Microsoft as well. Neither is wired into this prototype.

Do not infer calendar hosting from the Apple Calendar app. Inspect which accounts actually host Kerry's calendars; they might be Google, Microsoft, iCloud, subscribed feeds, or local calendars.

## Google direct

Register a dedicated project and web OAuth client, enable Calendar API, and configure the consent audience and redirect URI. For calendar discovery and event reading, start with `calendar.calendarlist.readonly` plus `calendar.events.readonly`; defer event write permissions until scheduling is implemented. [Google scopes](https://developers.google.com/workspace/calendar/api/auth).

For an always-available appliance, favor backend authorization-code exchange and securely stored refresh tokens over relying on repeated interactive browser authorization. External OAuth applications left in Testing receive refresh tokens that expire after seven days for calendar scopes. Resolve publishing/verification requirements for the intended personal audience before calling the appliance unattended. [Google OAuth](https://developers.google.com/identity/protocols/oauth2).

Engineering still required: consent-denied/revoked states, pagination, calendar selection, recurrence expansion, incremental sync/recovery, caching and stale-data indication. Start with read-only access and retain provider links for editing. Do not reuse InstaPI OAuth credentials or token storage without a deliberate auth design.

## Nylas

Current advertised pricing is USD $0/month for five email/calendar connected accounts. Essentials is USD $15/month and includes ten email/calendar and ten calendar-only accounts; its extra calendar-only accounts are $1.70 each. Count provider accounts, not tablets or people. A two-person trial may fit Free, depending on the actual number of connected accounts. Verify dashboard entitlements before committing. [Nylas pricing](https://www.nylas.com/pricing/).

Use Hosted Auth with an API key kept on the server. Nylas manages provider connections through grants; the app still needs its own user/device authorization and must never trust a client-supplied grant ID without checking ownership. [Nylas authentication](https://developer.nylas.com/docs/v3/auth/).

iCloud uses an app-specific password, including through Hosted Auth. Nylas removes the CalDAV implementation work, but not that user onboarding step. [iCloud connector](https://developer.nylas.com/docs/provider-guides/icloud/).

Google connector setup remains a choice: own Google project or the Nylas Shared Google App. The pricing page describes Shared Google App access with Pro Annual's accelerator; don't assume it's included in Free. Confirm actual availability. Avoid requesting Gmail scopes for a calendar-only app. [Shared Google App](https://developer.nylas.com/docs/provider-guides/google/shared-gcp-app/).

Microsoft needs its provider configuration too. Nylas documents domain and publisher verification for production applications; tenant administrators can affect work-account onboarding. Validate Kerry's actual account type during the auth spike. [Microsoft authentication](https://developer.nylas.com/docs/provider-guides/microsoft/authentication/).

## Task storage and sharing

IndexedDB is a replaceable spike implementation, not a final shared-data architecture. If tasks stay separate initially, it supports validating capture and ranking immediately. If shared lists/tasks are required in the first usable version, introduce household/member identity, access controls and a sync backend before using the two tablets for real shared tasks. Keep a local cache either way. Provider auth may need a backend even when task storage stays local.

Before selecting a hosted database, settle: independent or shared lists; whether a phone must edit tablet tasks; offline conflict behavior for completion and rank; and who owns each task. No hosted database has been chosen.

## Physical tablet validation

1. Load on the Lenovo and Samsung, note actual CSS viewport and device pixel ratio. Hardware pixel dimensions are not CSS dimensions.
2. Try a realistic busy week; check readability from the intended distance, touch targets, scrolling and drag handles. Include all-day/overlap handling before real-calendar rollout.
3. Reload and restart the browser; check persisted tasks. Test offline launch only after adding a PWA cache.
4. Measure screen-on versus screen-off battery drain with realistic brightness and power availability.
5. Only then investigate wake/sleep, Android lifecycle and presence. The prototype makes no promise that a browser can wake a sleeping tablet.

No physical-device or real-account validation has been performed yet.
