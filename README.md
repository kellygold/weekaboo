<p align="center"><img src="public/brand/weekaboo-mark.svg" width="88" alt="Weekaboo's calendar mascot"></p>

# Weekaboo

**A free, privacy-focused calendar with room for the things you haven't scheduled yet.**

[Website](https://weekaboo.app/) · [Source code](https://github.com/kellygold/weekaboo) · [Build your own](#build-the-installed-apps) · [Privacy](#privacy-and-local-data)

Bring Google Calendar, Outlook and iCloud together. Keep a flexible task list beside your week. Switch between work, personal and your own calendar groups, with a little peekaboo along the way.

Weekaboo's installed apps connect directly to your calendar providers. There is no Weekaboo account, hosted database or required server. Your calendar cache, tasks and preferences stay on your device; your calendar provider still receives the calendar changes you make.

## What it does

- **Your calendars together:** multiple accounts and subcalendars, individual visibility and colors, custom groups, and bidirectional edits on writable calendars.
- **Tasks without pressure:** keep things undated, pick a focus day, add a deadline, or reserve a time block when useful. Completed tasks remain visible in their history.
- **A view for the moment:** day, four days, week, month and chronological schedule; adjustable time spacing and a resizable task pane.
- **Thoughtful details:** anchored event previews, in-app rich notes, meeting links, attendee responses, and drag-to-adjust times.
- **On-device personality:** a small animated mascot with short, optional greetings. No live AI service is needed to use the app.

## Platforms and installation

One React UI and TypeScript provider engine power native Android, iOS/iPadOS and macOS packages. The browser development app is also maintained.

| Platform | Current delivery |
| --- | --- |
| Android | Standalone APK/AAB; signed local builds and live provider checks |
| iPhone / iPad | Native Capacitor app; simulator coverage and physical iPad provider checks |
| macOS | Standalone Electron app and signed Apple Silicon DMG; live provider checks |
| Browser | Local development app; calendar access currently uses the optional Python backend |

**Public downloads are not available yet.** Store submission, macOS notarization and final release acceptance remain separate from successful local tests. See the [release checklist](docs/release-checklist.md) for the remaining work. Visit [weekaboo.app](https://weekaboo.app/) for the project website and [hello@weekaboo.app](mailto:hello@weekaboo.app) for support. Its source lives in [`website/`](website/); it does not host your calendar data.

## Privacy and local data

- Installed apps do not send calendar or task data to a Weekaboo server. They communicate with the providers you connect.
- Credentials use native protected storage or provider SDK caches. Calendar caches and task databases are app-private data, not a promise that every database field is encrypted.
- Each device connects to its accounts individually. **Tasks do not automatically sync between devices.** Settings → Export tasks / Import tasks provides a manual transfer and backup route; exports exclude account credentials.
- The application has no telemetry service. The website has no analytics, ads or signup form. Calendar providers, operating systems and any eventual download host have their own policies.
- Open source makes these choices inspectable. It does not replace security testing or protect an already-compromised device.

## Try the interface locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5188/?demo=1** for fictional sample calendars. This requires no provider account or backend; tasks created in the demo are stored in that browser origin.

For the separate static website:

```sh
npm run site:build
npm run site:preview
```

Open **http://127.0.0.1:5190**. See [website development](docs/website.md).

## Build the installed apps

Native OAuth registrations identify your build; they are not user credentials. Register the correct package/bundle and signing certificate with each provider. Keep native configuration local, use the supplied examples, and never embed a browser OAuth client secret or a user's tokens. See [how OAuth works and how to use your own registrations](docs/oauth-setup.md).

### Android

Requires JDK 21 and Android SDK 36 in addition to Node.js.

```sh
cp android/native-auth.properties.example android/native-auth.properties
# Configure your public native registration values.
sh scripts/android.sh resolve  # once, fetch the native dependencies
npm run android:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Google registration must match the package and signing SHA-1; Microsoft registration must match its signature hash and redirect. iCloud uses an app-specific password entered in the installed app. Google authorization currently requires Google Play services.

`npm run android:bundle` prepares an unsigned AAB once the native acknowledgment gate passes. The release gate verifies the locked SDK acknowledgment inventory before packaging. Signed APK/AAB preparation uses `npm run android:release` and an existing dedicated keystore; it never generates or replaces a key. Follow the [Android release procedure](docs/android-release.md).

### iOS / iPadOS

Requires full Xcode and an installed simulator runtime; Command Line Tools alone are insufficient. Minimum configured OS is iOS 17; minimum-OS acceptance testing remains open.

```sh
cp ios/native-auth.xcconfig.example ios/native-auth.xcconfig
# Configure your public Google iOS and Microsoft client identifiers.
sh scripts/ios.sh resolve  # once, to fetch the locked Swift dependencies
npm run ios:simulator
```

Open `ios/App/App.xcodeproj` and select the **Weekaboo** scheme for normal builds. **WeekabooValidation** includes tests. Device signing and distribution profiles are configured through your Apple developer account. The [iOS release procedure](docs/ios-release.md) prepares an App Store export locally; uploading to TestFlight is a separate release step. A development IPA is limited to its provisioned devices.

### macOS

```sh
cp desktop/native-auth.example.json desktop/native-auth.json
# Configure Google Desktop and Microsoft public application identifiers.
npm run desktop:dev
npm run desktop:package
npm run desktop:dmg
```

These commands prepare local development artifacts; they do not publish or notarize them. The Mac app keeps a separate profile in `~/Library/Application Support/Weekaboo`. Google and Microsoft sign-in use the system browser, PKCE and a temporary callback on the same Mac. No remote callback server is needed.

### Browser with live calendars

The browser integration currently uses a single-user Python backend. Installed apps do not use it. With Python 3.12+ and `uv` installed:

```sh
cp backend/.env.example backend/.env
chmod 600 backend/.env
# Set your encryption key and provider credentials locally.
bash run-backend.sh
# In a second terminal:
npm run dev
```

Vite proxies `/api` to port 8080. Keep the backend loopback-only; it has not been designed as a public multi-user service. Preserve its encryption key with private backups. [Microsoft integration details](docs/microsoft-calendar.md) describe the browser callback and provider behavior.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/` | Shared React interface and task/calendar domain |
| `src/engine/` | Direct-provider calendar engine, synchronization and writes |
| `src/engine/providers/` | Google, Microsoft Graph and iCloud/CalDAV adapters |
| `src/platform/`, `src/services/` | Platform contracts and injected application services |
| `android/`, `ios/`, `native/apple/` | Native authorization, networking, persistence and file bridges |
| `desktop/` | Electron main process, isolated IPC, storage and system-browser authorization |
| `backend/` | Existing browser-only Python adapter; not bundled in native apps |
| `website/` | Separate static project website |
| `tests/`, `scripts/` | Shared regression tests, builds and explicit platform validation |
| `licenses/`, `docs/attribution.md` | Upstream notices and asset provenance |

Keep provider behavior in the shared engine and OS-specific capabilities in narrow adapters. A new platform should not require another calendar UI or a copied provider engine.

## Development checks

```sh
npm run build
npm test
uv run --directory backend pytest -q --disable-warnings
```

Playwright uses fixture-backed tests. Install its browsers if needed with `npx playwright install chromium webkit`. Platform harnesses in `scripts/` test signed artifacts, native storage and lifecycle separately. Live-provider scripts explicitly opt into a connected profile, use unique attendee-free fixtures and verify cleanup; **do not run them casually against personal accounts**.

Use [CONTRIBUTING.md](CONTRIBUTING.md) for change and verification expectations, and [SECURITY.md](SECURITY.md) for handling sensitive reports. Private test receipts, personal data, credentials and generated build outputs are excluded from source control.

## License and credits

Weekaboo's original code is [MIT licensed](LICENSE). Selected calendar integration components were adapted from Mantel, with its MIT notice retained; Weekaboo does not depend on the Mantel application. Dependencies, vendor artwork, fonts and generated media have their own terms: see [third-party attribution](docs/attribution.md) and [asset provenance](licenses/ASSETS.md). The MIT license does not relicense third-party material or grant rights to provider trademarks.

## Support

If this project is useful to you, you can [support Burner Tools](https://buymeacoffee.com/burnertools)
on Buy Me a Coffee.
