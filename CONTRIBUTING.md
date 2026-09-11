# Contributing to Weekaboo

Weekaboo shares its interface and provider engine across platforms. Keep changes small enough to review, preserve current data and separate platform capabilities from product behavior.

## Before changing code

Read the [README](README.md) and the relevant implementation. Use the fictional browser demo for UI work. Native builds require your own local public OAuth registrations and, for signed distribution, your own signing setup. Never commit private configuration or use someone else's credentials.

For a feature or structural change, describe the problem and proposed behavior first. Routine bug fixes should include reproduction steps and the smallest useful regression check. Avoid broad refactors mixed with behavior changes.

## Validate the affected paths

- Run the TypeScript/browser build and relevant tests. Changes to shared behavior need coverage across the affected platforms, not only a desktop screenshot.
- Exercise loading, empty, failure and cancellation states when changing asynchronous interactions.
- Preserve task IDs, completion history, account isolation and existing user data during upgrades.
- Live provider checks need explicit account-owner authorization, uniquely identified synthetic events without attendees, direct readback and verified cleanup.
- Describe exactly what passed, the artifact or platform tested, and what remains unverified. A simulator pass does not establish physical-device or store readiness.

## Pull requests

Explain the user-visible problem, resulting behavior and validation. Use fictional data in screenshots. Keep private evidence, local paths, account labels, provider payloads and signing files out of the diff. Retain upstream copyright and license notices when adapting code or adding dependencies.

Do not report sensitive security findings in a public issue. Follow [SECURITY.md](SECURITY.md).
