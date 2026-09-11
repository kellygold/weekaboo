# Deferred: local AI / MCP integration

Requested 11 September 2026. **Planning only. Finish the current calendar release first.** No MCP server, listener, external authorization service or AI data transfer has been implemented or authorized by this note.

## Intended experience

Let a user explicitly connect a compatible AI client to Weekaboo so it can inspect the selected schedule and task list, and propose useful actions without another calendar implementation. Evaluate Claude desktop/Cowork and other MCP-capable tools against their supported connection modes when implementation begins; do not promise identical out-of-the-box support before testing the clients.

Preserve the standalone architecture. Adding an AI integration must not require a Weekaboo account, paid hosting or public server for ordinary app use.

## Reuse existing services

Place protocol handling in a small adapter over the existing application-service and provider-engine contracts. Reuse validation, per-account visibility/capability checks, conditional writes, recurrence semantics, task persistence and cleanup behavior. Do not let an MCP process manipulate raw SQLite rows or bypass existing mutation rules.

The UI, native shells and MCP adapter should share domain behavior. OS process communication, user approval and secure credential access stay in narrow platform adapters. Do not make React components or Electron internals into a general public API.

## First vertical slice: desktop, local and read-only

1. Inventory the current service contracts and identify a supported, versioned local application-service boundary.
2. Evaluate a local stdio MCP adapter and an authenticated app-owned IPC connection. Stdio would avoid a public HTTP listener, but a spawned local process still needs an explicit trust/pairing decision and process identity checks.
3. Offer a user-initiated “Connect AI tool” action showing selected accounts/calendars, task access and the specific client. Start with read-only grants; never silently expose every connected account.
4. Initial tools: list allowed calendars, read events in a bounded date range, and list allowed tasks. Return stable IDs, actual timing, timezone, completion state and explicit capability limits.
5. Use bounded pagination, request/time limits, predictable errors and minimal returned fields. Include location/description/attendees only when granted and needed.
6. Verify at least one real compatible client on a disposable profile before claiming support. Keep instructions reproducible and avoid copying user provider tokens into AI-client configuration.

## Separate authorization responsibilities

Provider OAuth already grants Weekaboo access to Google or Microsoft accounts; iCloud has an app-specific credential. **That permission must not automatically authorize an external AI tool.** Add a separate grant controlled by the user. Specify read and write permissions, allowed accounts and calendars, access to tasks, expiration and revocation. Show authorized clients in a visible connection list.

Provider refresh tokens, app passwords and signing material remain in their existing stores. Return domain data through the service boundary, not credentials. Any local pairing credential should be generated, scoped, protected and revocable; static shared keys or an unauthenticated localhost endpoint are not a suitable default.

If a remote HTTP MCP mode is later justified, evaluate the then-current MCP authorization standard and interoperable OAuth flow, including client/resource identification, redirect validation and PKCE. A remote mode introduces deployment, identity and operating-cost decisions and therefore needs a separate approved design. Do not start by building a hosted authorization framework for local stdio.

## Mutations come after read-only acceptance

Use separate write grants and retain in-app approval for consequential changes. An AI suggestion must not silently send guest invitations, delete meetings, edit a recurring series or move events across accounts. Show the exact proposed change and scope. Preserve provider conditional-write/conflict handling, idempotency/ambiguous-result rules, cancellation and auditability without logging private event bodies.

Proposed initial writes after review: create/update a local task or propose a time block. Calendar writes follow only after the authorization and confirmation design is tested. Calendar text and imported notes are untrusted data, not instructions to change tool permissions or read additional accounts.

## Privacy implications

Connecting a cloud AI tool can send selected local calendar/task data to that tool's provider. Explain this directly before connection. Weekaboo's no-server design remains true, but “data never leaves the device” would be false for that optional use. No background AI requests or telemetry by default. Users should be able to disconnect the client without disconnecting their calendar accounts.

## Platform scope

Desktop is the first candidate because it can host an app-owned local process/IPC interface. iOS and Android lifecycle/sandbox constraints need their own design; do not assume a tablet can run a permanent MCP listener. Evaluate system share/actions or an explicitly invoked local bridge later, without adding a dependency on a home computer for the calendar app itself.

## Acceptance checklist for that future project

- [ ] Document client compatibility and supported transport/version from current primary sources.
- [ ] Threat-model local process access, external content, unintended account access and write approval.
- [ ] Test grant creation, least privilege, denied access, expiration, revocation and app restart.
- [ ] Verify no credentials or unselected calendars appear in responses/logs/config exports.
- [ ] Prove shared-service behavior and conflict protection; no duplicate provider engine.
- [ ] Validate actual client setup, errors, cancellation and disconnect on supported platforms.
- [ ] Update privacy explanations and user documentation before enabling the feature.

This stays outside the current MVP/release checklist, except for preserving reusable service boundaries.
