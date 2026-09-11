# Microsoft calendar integration

Weekaboo owns this adapter; it uses Microsoft Graph v1.0 directly, without the Mantel application or a paid calendar API intermediary. It shares the same account, calendar, event, edit queue and UI contracts as Google and iCloud.

## Configure an installation

1. Register an app in Microsoft Entra with **Any Entra ID tenant + Personal Microsoft accounts**. This supports Hotmail, Outlook.com and Microsoft 365 users.
2. Add a **Web** redirect URI matching `PUBLIC_BASE_URL` plus `/api/accounts/microsoft/callback`. The current local value is `http://localhost:8080/api/accounts/microsoft/callback`.
3. Add delegated Microsoft Graph permissions: `User.Read`, `Calendars.ReadWrite`, `offline_access`. Add `Calendars.ReadWrite.Shared` for optional organizational sharing. Application permissions aren't used.
4. Create a client secret. Put its **value**, not secret ID, in `MICROSOFT_CLIENT_SECRET` in the private `backend/.env`; put the application/client ID in `MICROSOFT_CLIENT_ID`. Keep both on the backend and restart it. Record the secret expiry in your own operational process.
5. Open **Connected calendars → Manage accounts → Connect Microsoft**. Leave shared work calendars unchecked for Hotmail or Outlook.com. Enable it when connecting a work/school account that needs organizational shared-calendar access.
6. Complete Microsoft sign-in and consent, then enable the desired subcalendars. Newly discovered calendars start disabled, just like the other providers.

Organizational consent policies may require an administrator. The app registration's administrator account does not need to be the account whose calendar you connect.

## Provider behavior

- Supports multiple accounts; reconnecting uses Microsoft's stable account ID and preserves calendar IDs/preferences when a sign-in email alias changes.
- Enumerates paginated `/me/calendars`, including shared calendars exposed in the signed-in user's mailbox. `canEdit` controls editing. Sharing permissions do not automatically discover arbitrary mailboxes; a shared calendar needs to be accepted/added in Outlook and visible to Graph.
- Reads a complete paginated `calendarView`, including expanded recurring occurrences and exceptions. The default window is 90 days back (`SYNC_PAST_DAYS`) and 365 days forward (`MICROSOFT_SYNC_FUTURE_DAYS`, configurable 30–730). Previously cached history outside this window is retained but no longer refreshed. Navigating beyond it does not trigger an additional fetch.
- Prunes missing events only after a complete successful snapshot. Failed pages or invalid event dates leave the prior cache intact. Pending writes and out-of-window history are retained.
- Uses immutable event IDs and encodes opaque identifiers. Normalizes Windows/IANA time zones, civil dates for all-day events, descriptions, locations, attendees/RSVPs, provider links and Teams/online meeting URLs.
- Creates, changes and deletes events on writable calendars. Creation retries use a stable Graph transaction ID. Uses the existing record-level last-write-wins rule and conditional writes; a newer remote change wins over an older local edit, while a later local edit can retry against the current revision.
- Supports new daily, weekly, monthly and yearly repeats. Existing imported occurrences edit individually. Unsupported repeat conversions are rejected before entering the edit queue.
- Preserves attendee lists, categories and online meeting data during title/time/location changes. Online meeting notes are editable inside Weekaboo. The adapter fetches the latest body and preserves the exact generated Teams block while replacing user notes. Unrecognized joining templates are retained and blocked from destructive replacement. Attendee management and generating new Teams links aren't part of the current event editor.
- OAuth uses a ten-minute, single-use, browser-bound state ticket with PKCE. Personal/default login uses `common`; the optional organizational sharing flow uses `organizations`. Refresh tokens are encrypted and rotated. Errors omit raw token responses; throttling respects `Retry-After`.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `api/microsoft_accounts.py` | Browser handshake and account linking |
| `integrations/microsoft_oauth.py` | Consent, code exchange, encrypted token lifecycle |
| `integrations/microsoft_api.py` | Graph transport, pagination, origin checks and throttling |
| `integrations/providers/microsoft.py` | Calendar/event mapping and provider operations |
| `integrations/providers/registry.py` | Provider selection and local validation dispatch |
| `integrations/event_mapping.py` | Shared conversion used by validation and queued writes |
| `integrations/sync_engine.py` | Shared queue, conflict rule and snapshot reconciliation |
| `src/calendar-providers.ts` | Shared provider names in account/calendar UI |

No Microsoft SDK or new runtime package is required. The Unicode CLDR Windows time-zone map is vendored with its license.

## Verification and limits

Automated tests use fake Microsoft HTTP responses and browser API fixtures, including remote state after writes. They never modify real calendars. Real Hotmail/Outlook sign-in, sharing policy behavior and provider CRUD require a user-authorized live check after setup; automated passing tests alone do not establish those results.

The backend remains loopback-only and single-user. This integration does not make the application publicly hostable or independently installable on Android/iOS. Native clients will require a public-client/PKCE flow and platform-appropriate secret storage; a backend client secret must never be bundled into an APK or browser build.

## References

- [Microsoft app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Calendar views](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)
- [Shared calendars](https://learn.microsoft.com/en-us/graph/outlook-get-shared-events-calendars)
- [Event updates and online meeting body preservation](https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0)
- [Immutable Outlook identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id)
