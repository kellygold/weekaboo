# Android submission packet

Prepared 12 September 2026. **Draft for review; no Play app record, upload, test-track rollout or production submission performed by this packet.** Runtime evidence is for `d3bcf4b`; preparation began at `d2ae0d7`, with subsequent documentation/website commits. Consult [current validation](current-validation.md) for the exact artifact and remaining release gates. A successful local AAB check is not Play acceptance.

## Candidate and store fields

| Field | Prepared value / decision |
| --- | --- |
| App name | Weekaboo |
| Package | `app.weekaboo.calendar` — retain the existing identity |
| Current version | `0.1.0`, version code `1`; increase before any later upload that reuses an accepted version code |
| Artifact | `android/app/build/outputs/bundle/release/app-release.aab`; exact current hash belongs in the release receipt immediately before upload |
| SDK | Minimum 24, target/compile 36; minimum supported OS is a build setting, not proof that every such device was tested |
| Type / category | App / Productivity (proposed) |
| Price / ads / purchases | Free; no advertising or in-app purchases in this candidate |
| Website | `https://weekaboo.app/` |
| Privacy | `https://weekaboo.app/legal/privacy-policy/` |
| Public support | `hello@weekaboo.app`; Kelly confirmed the domain catch-all forwards to the existing inbox |
| Audience / rating | General personal productivity. Complete the actual age-group and content-rating questionnaires; a playful mascot alone does not establish a child-directed product |

The new Google project and direct-release registration already exist. Do not ask Kelly to recreate them. Play's installed-app signing certificate must still be compared with the direct APK certificate. An upload key is not that certificate. If Play uses a different certificate, add that package/fingerprint to Google and the corresponding signature callback to the existing Microsoft app. Test the actual Play-installed build before inviting the wider group. See [signing and artifacts](android-release.md).

## Listing copy

**Short description**

> A private calendar with flexible tasks and Google, Outlook and iCloud.

Keep price language out of the short description and preview artwork; the website can still prominently explain that Weekaboo is free. [Play listing guidance](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en).

**Full description**

> Make room for your day with Weekaboo, a free, open-source calendar with flexible tasks.
>
> Bring Google Calendar, Outlook and iCloud calendars into one view. Switch between a day, four days, a week, a month or a readable schedule. Group calendars into contexts such as Work and Personal, then choose what you want to see.
>
> Keep the things you need to remember without turning every task into an appointment. Leave a task undated, choose a day, add a deadline, or set aside time when you need it. Mark it done when it is done.
>
> Create and edit events on connected calendars, with changes sent back to the calendar service. See event details, guests and meeting links when the provider supplies them. Calendar permissions determine which events you can edit.
>
> Your calendar connects directly to its provider. There is no Weekaboo account and no Weekaboo server storing your calendars or tasks. Tasks, preferences and cached calendar information stay on your device. Google, Microsoft and Apple still process the information needed to provide the accounts you connect.
>
> Designed for a calendar you can keep in view, with adjustable calendar zoom and a calm tablet layout. Tap the Weekaboo mascot for a little greeting.
>
> Tasks are local to each device; they do not automatically sync between devices. Connecting calendars requires an internet connection and an account with the chosen provider. Google connection on Android uses Google Play services. iCloud uses an app-specific password.
>
> Free, with no ads or subscription. Explore the source at github.com/kellygold/weekaboo.

**First test-release notes**

> First Android test release. Connect Google, Outlook and iCloud calendars, switch calendar views and groups, and keep flexible local tasks. Please report connection, refresh, scheduling and tablet-layout issues. Tasks stay on each device and do not automatically sync.

Use real screenshots of the candidate with synthetic data. Prepare a 512 × 512 app icon and 1024 × 500 feature graphic, plus representative phone and tablet screenshots for the surfaces being listed. Do not use screenshots containing Kelly's calendars or promise untested phone quality. Check the final asset requirements in [Google's store asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB). Existing screenshots/artwork are inputs, not a completed Play asset upload.

## Getting testers installed

Kelly's verified personal developer account is subject to the closed-testing gate: at least 12 testers continuously opted in for 14 days before applying for production access. Installation alone does not complete that gate, and approval is not automatic. Record real feedback, resulting fixes and remaining issues during testing. [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

The intended route is a Play **closed test**, not an APK email chain. In Play Console, open the app's Closed testing track, configure an email list or Google Group, add the testers, set a feedback address, and copy the track's opt-in link after the test release is available. An internal test is useful first but is separate from the required closed test. A tester already enrolled in internal testing may need to leave that track before joining closed testing. [Track setup](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

No Weekaboo signup server is required. Keep the private tester list outside this repository. While Google OAuth remains in Testing, separately allowlist the Google accounts testers will connect in the Weekaboo Google Auth Platform. Their Play account and calendar account can differ; collect only the addresses needed for each list.

**Invitation text — replace the bracketed fields only after the track exists**

> Thanks for trying Weekaboo! Open [PLAY OPT-IN LINK] using the Google account you gave us, join the test, then follow its Google Play installation link. Please remain enrolled for at least 14 days and use the app during that period.
>
> Try an undated task, a task with a due date, and a scheduled task. Connect a calendar if you are comfortable doing so, change views, refresh, and try creating, editing and deleting an event made specifically for testing. Please avoid editing meetings with guests as a test.
>
> Send feedback to [CONFIRMED FEEDBACK ADDRESS]: device model, Android version, Weekaboo version, what you did and what happened. Please leave passwords, private event details and sign-in codes out of screenshots. Tasks are stored on this device; export anything you want to keep before removing the app.

The website can later link to the real opt-in page and explain these steps. Do not publish a guessed Play URL. A signed APK download can separately support personal/family installation, but it does not count as Play closed testing. A direct-download release needs its own approved artifact/hash and installation instructions. Preserve the signing identity and task data; never instruct existing users to uninstall just to work around a certificate mismatch.

## App access instructions for reviewers

The tasks interface has no Weekaboo login. Full calendar review requires third-party account access. Provide reusable dedicated review credentials and English instructions in Play Console's restricted App access fields, not in source, screenshots or public listing text. Do not provide Kelly's account, app-specific password or personal MFA recovery material. Google requires usable access even when an app relies on third-party sign-in; reviewers cannot be assumed to supply their own accounts. [App access requirements](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-GB).

**Prepared instruction text; not complete until review accounts are provisioned and checked**

> Weekaboo does not require its own account. On launch, use Your things to add and complete a local task. Open Connected calendars to connect a provider. Use the dedicated account supplied in this review entry for the corresponding provider. Google and Microsoft open their provider sign-in interface; iCloud asks for an Apple Account address and app-specific password. After connecting, select its calendar and refresh. Use New event to create an attendee-free review event; open it to edit its notes or time, then delete that review event. Please do not modify other sample events. Accounts can be removed from Connected calendars.

Engineering/owner gate: prove these dedicated accounts work from a fresh installation without Kelly's intervention, geography-dependent prompts or expiring one-time codes. Seed only synthetic calendar content. Resolve Google OAuth test-user access or verification for those accounts. If provider policy prevents a reliable review account, obtain a permitted review-access arrangement before submitting; do not conceal a nonfunctional provider or build an undocumented review bypass.

## Data safety draft — requires final SDK resolution

This is a technical input to the form, **not permission to select “no data collected.”** Play's collection definition includes data sent off device by the app or its SDKs, even when Weekaboo operates no server. Local-only processing is different. Collection, sharing exceptions and ephemeral processing are separate questions. [Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

| Data / actual behavior | Proposed treatment and unresolved points |
| --- | --- |
| Calendar events: titles, times, descriptions, event locations and guests | Direct provider reads/writes support calendar functionality. Conservatively prepare Calendar events as collected for app functionality, optional to connecting a provider, associated with that account; not ephemeral because provider events persist. Final form mapping must cover data in event fields rather than falsely claiming those fields never leave device. |
| Connected account email / provider account ID; display name when returned | Identity discovery and account selection use provider requests. Prepare Email address and User IDs; inspect actual name handling/SDK disclosures before deciding Name. Optional to provider connection, app functionality/account management. |
| Tasks, calendar grouping and display preferences | App-owned implementation stores these locally. No off-device collection by Weekaboo's task implementation; explicit user export is a separate action. Do not extend this statement to provider events or authentication SDKs. |
| Authentication credentials | Native SDK caches / protected credential stores; tokens are used in HTTPS requests and short-lived tokens enter the trusted bridge. No claim that tokens never leave Keychain/Keystore. The form taxonomy and vendor disclosures must be reconciled rather than inventing a credential category. |
| Diagnostics, device identifiers, app interactions, IP-derived location | **Unresolved for the exact bundled authentication SDKs.** No app-owned analytics/ads SDK was found. That does not prove the sign-in SDKs collect none of these categories. Do not select No or ephemeral without vendor/configuration evidence. |
| External meeting/map links | Opened by user action with a separate destination. Document that destination's involvement; do not describe third-party services as Weekaboo storage. |
| Support email | Optional messages are handled by the configured mail services. Do not encourage sending calendar exports or credentials. Assess in-app collection separately from a user independently emailing support. |

Sharing: determine whether each provider transfer meets Google's user-initiated transfer or other applicable exception. Do not classify all providers as processors acting for Weekaboo, and do not treat a sharing exception as a collection exemption. Retention is not uniformly ephemeral. Deletion instructions must distinguish local account/cache removal, local tasks, provider grant revocation and deletion of provider events. Removing an account does not delete its provider calendar. [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

App-owned provider/auth traffic uses HTTPS; the final security answer must include vendor paths. There is no Weekaboo account creation flow, so do not invent a Weekaboo account-deletion service. Complete Play's actual account-creation question against the submitted flow, including its treatment of external accounts.

### Exact dependency / permission checkpoint

Inspected `android/app/gradle.lockfile`, the release merged manifest and manifest-merger report on 12 September:

- Google `play-services-auth:22.0.0`; Microsoft `msal:8.4.2`, common `24.6.0`.
- MSAL configuration disables PII and logcat logging. This does not establish that all remote SDK telemetry is disabled.
- Release manifest: Internet, network state, the app's non-exported dynamic-receiver permission, **NFC**. NFC originates from transitive `com.yubico.yubikit:android:2.5.0`; permission presence alone does not prove NFC data collection. Inspect/justify or safely remove unnecessary dependency functionality in a separately validated change.
- `allowBackup=false`; release debugging disabled. The locked native notice inventory covers 91 records; licenses are not a privacy disclosure audit.
- Google's general Play-services core disclosure is explicitly scoped to its listed libraries; do not assume it describes the AuthorizationClient library. Microsoft/iOS privacy manifests are not a substitute for Android-specific practices.

Before the final form, engineering must close each uncertain SDK category with exact vendor documentation/configuration evidence and, where needed, bounded runtime inspection. Kelly should review a completed technical matrix, not guess it. See [privacy inventory](privacy-disclosures.md), [Google core disclosure boundaries](https://developers.google.com/android/guides/play-data-disclosure) and [responsibility for SDK behavior](https://support.google.com/googleplay/android-developer/answer/13323374).

## Outstanding actions and owners

| Owner | Action before the relevant rollout |
| --- | --- |
| Engineering | Finish the exact-candidate validation and independent review gates in current-validation; resolve Android SDK disclosure uncertainties and prepare synthetic store images. Recheck package/version/signature/hash immediately before upload. |
| Kelly / authorized Play Console operator | Confirm/create the Weekaboo app record if absent, confirm public contact/age-group declarations, complete content rating and review the final Data safety answers. Identity verification already completed. |
| Kelly + engineering | Choose/enroll the Play app-signing arrangement using existing key material appropriately; record actual installed-app certificate, add provider registration only if different, validate Play-installed sign-in. No key rotation implied. |
| Kelly + engineering | Supply dedicated provider review access through restricted fields; test it. Confirm the public support identity selected in Console. |
| Kelly / authorized operator | Add tester emails/group, approve the exact AAB and track rollout, copy the actual opt-in link. This packet authorizes no upload or invitation messages. |
| Testers + maintainer | Complete the real closed-test period; record engagement/feedback and fixes, then apply for production access with truthful answers. |
| Engineering + Kelly | Complete [Google verification packet](google-verification-packet.md); store approval and Google OAuth approval are separate. |

Website publication is being handled separately. Public APK/AAB distribution, Play uploads and production rollout remain explicit release actions. A listing draft is ready for review; release readiness is not asserted here.
