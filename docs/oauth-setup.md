# OAuth setup: official app and your own build

Weekaboo uses provider OAuth registrations to identify the application and obtain each user's permission. Installing an app does not authorize calendar access automatically, even when the account is already on the device.

## If you install an official Weekaboo build

The build includes Weekaboo's native registration identifiers. Open Connected calendars, choose Google/Microsoft/iCloud and complete that provider's flow. You do not need a Google Cloud project or Microsoft Entra application of your own. Each device authorizes its own access; signing into the same calendar accounts does not synchronize Weekaboo tasks.

The consent screen's product name comes from the provider's app/consent configuration, not the app's visible title. Current Google test registrations still share an older project's consent branding. Correcting that is an explicit release gate; changing the React title does not fix it.

## What is public and what stays private?

| Value | Purpose | Handling |
| --- | --- | --- |
| Native client ID, package/bundle ID, signing certificate fingerprint, callback URI | Identify the app and validate its authorization return path | Public registration metadata; included in appropriate native builds |
| Google Desktop installed-client `client_secret` field | Parameter supplied with Google's Desktop client registration | An installed client cannot keep this confidential. Our Mac config is bundled; it is not a web-server credential or proof that the binary is trustworthy |
| Browser-backend Google/Microsoft web-client secrets | Authenticate the confidential web-server client | Private backend environment only; never copy into native apps, website or public source |
| User access tokens, refresh state, iCloud app-specific password | Authorize access to that user's account | Runtime protected storage / provider SDK cache; never part of source or distributed app configuration |
| Signing private key | Sign releases and preserve upgrade identity | Kept outside source/build assets; a public signing fingerprint does not reveal the key |

Android's Google AuthorizationClient can select a Google account already on the device, but still requests calendar scopes for the registered app. iOS uses Google Sign-In and app-specific consent; it does not inherit Google permissions from Apple Calendar. Microsoft uses MSAL public clients. macOS uses the system browser with PKCE and a temporary loopback callback. iCloud uses direct CalDAV with an app-specific password rather than these OAuth clients.

The native app contains no Weekaboo-owned remote token broker. A short-lived access grant can cross the trusted native bridge into the shared provider engine to perform requests; do not describe all token material as permanently confined to an OS keychain. Long-lived refresh state and passwords are not exported with tasks.

## If you build your own version

Create native clients under projects/accounts you control, configure the files below, and rebuild. This is supported developer configuration, **not an in-app configuration wizard**. Official signing keys are never shared; a differently signed Android build needs a matching provider registration even if the package string is unchanged.

Start with `npm ci` and `npm run native:setup`. The latter reports local tooling/registration status without displaying private tokens. Follow the platform build commands in the README.

### Google

In [Google Cloud OAuth clients](https://console.cloud.google.com/auth/clients), select your project, configure its consent audience/branding, enable the Calendar API, and create the appropriate native client. Development/test users and public sensitive-scope verification are separate provider-console steps.

- **Android:** create an Android client matching your package name and the SHA-1 of the certificate actually signing your build. This app's AuthorizationClient uses that package/signature identity; there is no Google client-secret field in `android/native-auth.properties`. A Play-distributed build may use a different app-signing certificate from a locally installed build.
- **iOS:** create an iOS client matching the bundle ID. Copy `ios/native-auth.xcconfig.example` to `ios/native-auth.xcconfig`; set `WEEKABOO_GOOGLE_CLIENT_ID` and `WEEKABOO_GOOGLE_REVERSED_CLIENT_ID` from your native configuration. Do not add a web client secret.
- **macOS:** create a **Desktop app** client. Copy `desktop/native-auth.example.json` to `desktop/native-auth.json`; use the downloaded installed-client ID and installed-client secret parameter. Do not use a Web client. The application opens a temporary loopback listener on the same Mac and verifies callback state/PKCE.

### Microsoft

In [Microsoft Entra app registrations](https://entra.microsoft.com/), create a registration supporting the intended audience. Personal Outlook/Hotmail plus work/school accounts require the audience allowing both organizational and personal Microsoft accounts.

Use **delegated** Graph permissions for the signed-in user: `User.Read` and `Calendars.ReadWrite`, plus the supported shared-calendar permission when needed for organizational accounts. Offline access is requested by the authorization flow where applicable. Broad application permissions are not required for this standalone design.

One Microsoft app registration can contain multiple platform entries:

- **Android:** add the package and matching base64 SHA-1 signature hash. Copy `android/native-auth.properties.example` to `android/native-auth.properties`; set the public Microsoft client ID and signature hash. Entra derives the matching `msauth://...` redirect. Release builds derive the callback hash from their actual signing certificate; register that certificate too.
- **iOS/macOS platform entry for the iOS app:** register the actual iOS bundle ID. For the default ID, the redirect is `msauth.app.weekaboo.calendar://auth`. Set `WEEKABOO_MICROSOFT_CLIENT_ID` in the local iOS config.
- **Desktop Mac implementation:** add **Mobile and desktop applications → `http://localhost`** for the loopback flow and put the public Microsoft client ID in `desktop/native-auth.json`. The Android `msauth://...` redirect is not interchangeable with this callback.

Do not create a Microsoft client secret for native public-client flows.

### iCloud

No Weekaboo OAuth client registration is required. Generate an app-specific password through your Apple account and enter it in Connected calendars on the device. Keep it out of config files, screenshots and source. The password is stored through the native credential adapter.

### Changing application identity

The current example package/bundle is `app.weekaboo.calendar`. A redistributed fork should deliberately update native package/bundle identifiers, callback URL schemes, signing and provider registrations together. There is no one-command identity-renaming tool yet. Do not assume editing a display name or one environment variable updates Java namespaces, Xcode settings and provider callbacks.

## Files and build boundary

| Platform | Example to copy | Local destination |
| --- | --- | --- |
| Android | `android/native-auth.properties.example` | `android/native-auth.properties` |
| iOS | `ios/native-auth.xcconfig.example` | `ios/native-auth.xcconfig` |
| macOS | `desktop/native-auth.example.json` | `desktop/native-auth.json` |
| Browser backend | `backend/.env.example` | `backend/.env` |

Destinations are ignored by Git. This prevents accidental source publication; it does **not** make the native values secret after packaging. Build scripts intentionally place native registration metadata in the installed app. The backend environment, user credential stores and signing private keys must stay outside it.

Primary references checked 11 September 2026: [Google native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Android AuthorizationClient](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationClient), [Microsoft public/confidential clients](https://learn.microsoft.com/en-us/entra/msal/msal-client-applications). Provider registrations identify apps; user consent grants account access. Those are distinct responsibilities.
