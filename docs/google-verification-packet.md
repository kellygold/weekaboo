# Google OAuth verification packet

Prepared 12 September 2026 for `weekaboo-app` (project number `124770503970`). This is the concrete preparation packet, **not a submitted or approved verification request**. Scope reduction below is proposed, not implemented. Runtime validation remains at `d3bcf4b`; see [current validation](current-validation.md) and [migration evidence](google-project-migration.md).

## Existing setup — preserve it

All five replacement registrations were received: Android release, Android development, iOS, macOS Desktop and Web/local backend. Calendar API is enabled. Billing is not attached and no Weekaboo server was provisioned. Fresh new-project consent and account discovery passed on Android direct release, Mac, browser and iOS simulator. This is not proof of a Play-installed signature, current physical iOS build or unrestricted public Google approval.

Normal users use Weekaboo's public OAuth client registration; they do not create their own Cloud project. Native clients do not embed a confidential Web secret. Existing client files and the browser backend secret remain private and ignored. Android identifies its registration by package/signature; do not manufacture additional clients unless the actual Play app-signing certificate differs. Microsoft and iCloud are outside this Google project migration.

## Branding and public destinations

| Console field | Intended value / verification state |
| --- | --- |
| Product name | Weekaboo; confirm the Console's existing “Weekaboo App” naming is deliberate and consistent with the demonstration |
| Audience | External; test users have been added. Testing is not production approval |
| Homepage | `https://weekaboo.app/` |
| Privacy policy | `https://weekaboo.app/legal/privacy-policy/` |
| Terms | `https://weekaboo.app/legal/terms-of-service/` |
| Authorized domain | `weekaboo.app`; remove any unused example-domain row |
| Source code | `https://github.com/kellygold/weekaboo` |
| Developer notification address | `developer@weekaboo.app`, as supplied by Kelly; delivery not independently tested |
| Public user-support email | Recommend `hello@weekaboo.app`, now used by the website; Kelly confirmed catch-all forwarding. Google eligibility/selection remains to be checked |

The static site was published on 12 September from `e679c61`: [successful deployment](https://github.com/kellygold/weekaboo/actions/runs/34656414160). Homepage, canonical privacy and terms URLs now load over HTTPS; all28 public files match the reviewed build and eight Chromium/WebKit viewport checks pass against the real domain. Initial DNS/404 failures are retained in private evidence and superseded by these successful checks. **Google Search Console ownership remains unconfirmed; do not submit until it is verified.** The www certificate is being reprovisioned separately; the configured OAuth URLs use the working apex. See [website evidence](website.md#publication-and-maintenance).

Kelly confirmed that ImprovMX catch-all forwarding is configured for `weekaboo.app`; no paid Workspace purchase is needed for that forwarding. The forwarding address existing in ImprovMX does not automatically make it a selectable Google support identity; inspect the account/managed Google Group choices offered in Branding. Do not expose the personal Gmail by accident or change another project's identity. The private notification contact is separate from the public support contact.

Concrete no-Workspace route if the alias is not already eligible: Kelly creates a Google account using the existing `hello@weekaboo.app` address (without creating Gmail), verifies the forwarded email, grants that identity project Editor or Owner access as appropriate, then signs into the Console with it and selects it as support email. A Google Group managed by the signed-in user is another eligible choice. This account/access change needs Kelly's interactive setup; no IAM changes were made here. [Google support-email eligibility](https://support.google.com/cloud/answer/15544987?hl=en).

Google requires a representative public site, privacy policy, domain ownership and matching application identity for verification. Prepare a demonstration of the actual consent and scoped features. [Sensitive-scope verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

Console entry points: [Branding](https://console.cloud.google.com/auth/branding?project=weekaboo-app), [Audience](https://console.cloud.google.com/auth/audience?project=weekaboo-app), [Data Access](https://console.cloud.google.com/auth/scopes?project=weekaboo-app), [Clients](https://console.cloud.google.com/auth/clients?project=weekaboo-app).

## Scope audit and least-privilege decision

The shared Google reader calls `users/me/calendarList` and calendar event endpoints. The writer uses event GET, POST, PATCH and DELETE. The inspected UI/provider code does not manage calendar ACLs or create/delete calendars. Browser implementation must remain part of the final audit, not just the native engine.

| Scope | Current use / proposed disposition |
| --- | --- |
| `https://www.googleapis.com/auth/calendar` | Currently requested across platform implementations. Broader than the observed calendar-list and event operations; **do not claim that no narrower scopes can work**. |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Proposed replacement component: discover the calendars the user can select, their labels/colors and access roles. The calendar-list API accepts this scope. |
| `https://www.googleapis.com/auth/calendar.events` | Proposed replacement component: read and modify events on calendars to which the user has the relevant rights, including shared calendars. Event APIs accept this scope. |
| `https://www.googleapis.com/auth/userinfo.email` | Retain only as actually requested/needed for identifying and labeling connected accounts and avoiding identity ambiguity. |
| `openid` and SDK identity scopes | Audit the actual platform requests/grants and declare them accurately. Do not add speculative scopes or conceal SDK-requested identity permissions. |

Scope definitions: [Calendar authorization](https://developers.google.com/workspace/calendar/api/auth). Method evidence: [calendar-list read](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list), [event insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [event patch](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch), [event delete](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete).

`calendar.events.owned` would omit editable shared calendars. Read-only calendar scopes cannot support editing. App-created-calendar-only access would omit a user's existing calendars. No extra calendar-management scope should be added unless an actual endpoint requires it.

**Engineering gate before submission:** choose and implement the minimal scope set in all authorization adapters, scope validators, browser backend and any reconnect handling; preserve old grants safely; then prove owned/shared calendar discovery, recurrence, event CRUD, meeting details, token acquisition and reconnect. A Console declaration change alone does not change the app's requested permissions. This packet changes neither code nor provider permissions and does not require Kelly to recreate the five clients.

### Prepared scope justifications

These paragraphs are ready to adapt **after the narrower implementation is tested**. They must not be submitted as a description of today's full-calendar request.

**Calendar list read:** Weekaboo lets the user choose which of their existing Google calendars to display and group into personal contexts. We read the user's calendar list to show calendar names, colors and access roles and to address subsequent event requests. Weekaboo does not create or delete calendars or change their sharing permissions.

**Calendar events:** Weekaboo displays the user's selected calendars alongside their other connected providers. Users can open event details and create, edit or delete events where their calendar permissions allow it. Event changes are sent directly to Google on the user's action. Read-only access would not support these edits, and owned-only access would omit shared calendars that the user is permitted to edit.

**Email identity:** Weekaboo displays the connected account address so the user can distinguish multiple accounts and select the intended calendar. Identity information is used for account association and connection management, not advertising or profile enrichment.

For the current broad scope, the honest description is that it is a legacy implementation choice under reduction review. Do not present that choice as a functional requirement for ACL or calendar deletion features the product does not have.

## Product and data-use narrative

**Prepared application explanation**

> Weekaboo is a free, open-source personal calendar and task application. Users connect calendars they control and choose which calendars to display. They can read event details and create, edit or delete events when authorized by that calendar's permissions. Calendar groups help them switch between contexts such as work and personal life. Tasks can remain undated or be scheduled and are stored locally.
>
> The native application communicates directly with Google. Weekaboo does not operate an intermediary calendar server or central user database. The application keeps calendar cache, tasks and preferences on the user's device and uses platform-protected authentication storage. Google receives the requests needed for its service. We do not sell Google user data, use it for advertising, or use it to train generalized AI models. There is no Weekaboo analytics service reading calendar content. Users can disconnect an account and revoke the provider grant; removing a connection does not delete events from the provider's calendar.

The maintained browser application currently uses a **user-run local backend**, with its Web OAuth callback at `http://localhost:8080/api/accounts/google/callback`. It is not the static marketing site and must not be described as a publicly hosted serverless browser calendar. The website needs no OAuth client or login. Mac uses a Desktop client/system-browser loopback flow; Android and iOS use their native adapters. Describe these distinctions if Google requests the client inventory.

Privacy copy includes the Google API Services User Data Policy / Limited Use statement. Verify that implementation, support handling and dependency practices match that statement; open source and absence of a Weekaboo server do not exempt third-party data use. [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy). The separate [Android disclosure draft](android-release-submission.md) records unresolved SDK taxonomy, rather than asserting zero off-device collection.

## Demonstration and reviewer materials

Prepare a clean English-language recording on the exact candidate after scope finalization:

1. Show the Weekaboo product, public homepage/privacy link and Connected calendars entry point.
2. Start fresh Google consent using a dedicated account containing only synthetic calendar data. Show the new Weekaboo branding and every requested permission clearly. Do not expose passwords, tokens, authorization codes or unrelated accounts.
3. Return to Weekaboo, show the correct account and calendar list, select the synthetic calendar and display its events.
4. Create one uniquely titled attendee-free event, open and edit it, show the change in Google's calendar, and delete only that fixture. Show any shared-calendar feature used to justify access with a synthetic shared calendar and appropriate rights.
5. Show account disconnection and explain provider grant revocation/local data boundaries. Record other platform flows if requested or needed to explain different scopes; one Android video is not proof of every client flow.

Upload only an approved, sanitized recording to an accessible unlisted video location and put the real URL in the verification form. No video URL is supplied yet. Existing private validation screenshots/receipts are useful engineering evidence but are not automatically safe public reviewer material. Do not revoke Kelly's existing consent simply to stage the recording.

Reviewer account details, where required, go into Google's restricted submission fields. Provision permitted reusable test access with synthetic data, resolve MFA/organizational restrictions, and prove the instructions from a clean environment. Do not store account credentials in this document or rely on a reviewer already appearing in the current private tester list.

Submission attachments to prepare: final scope inventory, justifications matching actual requests, source/client inventory, approved logo, public policy/homepage proof, domain-ownership proof, sanitized demo URL and reproducible access instructions. Branding review, sensitive-scope review and Play store review are separate processes. [Verification preparation](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## Final actions by owner

| Owner | Concrete action |
| --- | --- |
| Engineering | Implement/test the agreed least-privilege scope set across all five paths and update this packet's proposed/current labels. Do not silently change scopes during documentation work. |
| Website lane | Apex publication and canonical HTTPS verification complete. Finish www certificate/redirect check; maintain live policy/source links. |
| Kelly or authorized domain owner | Complete Search Console ownership if not already verified under the Google identity used for verification. Existing DNS ownership alone is not evidence that Google has accepted ownership. |
| Kelly | Choose an eligible public support identity in Branding, preferably `hello@weekaboo.app`; catch-all forwarding is confirmed. Confirm the separate notification address and remove placeholder domains. No paid Workspace purchase assumed. |
| Engineering + Kelly | Prepare permitted dedicated review account access and sanitized video; owner supplies any unavoidable interactive account/MFA or video-host approval. |
| Engineering | Recheck actual Android Play app-signing certificate when enrolled; add a client only if needed. Preserve existing native and browser registrations. |
| Kelly / authorized Console operator | Review the exact final packet and submit the appropriate branding/scope verification request; respond to Google's follow-up emails. No submission has been made in this lane. |

Keep Google OAuth test users distinct from the Play closed-test list. The Play 12-tester requirement does not verify OAuth, and an approved OAuth consent screen does not publish the Android app. Completing domain and registration setup likewise does not close runtime release-validation gaps.
