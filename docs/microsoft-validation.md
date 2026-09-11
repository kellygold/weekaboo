# Microsoft integration validation — 9 September 2026

## Scope and evidence

Microsoft Graph/OAuth adapter, account setup, provider-neutral event validation, complete-window reconciliation, stable create retries, account identity migration and existing provider regressions.

- Production frontend build passed (`npm run build`).
- All 202 backend checks passed; current run is recorded in `data/microsoft-backend-final.log`.
- Browser regression: 40 checks passed; one assertion still expected Google/iCloud-specific disconnect wording. After updating that assertion, all 10 affected account/detail/scheduling checks passed, including the three new Microsoft checks. A final OAuth UI cleanup was also checked with the Microsoft and MVP interaction suites. Logs: `data/microsoft-browser-regression.log` and `data/microsoft-browser-delta.log`.
- Account setup screenshots inspected at desktop, tablet and phone sizes. No horizontal overflow; checkbox layout corrected to use the shared style. Captures: `output/microsoft-review/`.
- Private database and encrypted-provider configuration backed up before restarting. Backup location is recorded locally in `data/microsoft-backup-path.txt`; don't publish that backup.
- Local service restarted with Microsoft configuration detected. Existing accounts/calendars/events retained; added account identity column. Built mascot/audio/fonts verified as file responses instead of the SPA fallback.

## Independent review: incomplete

A clean source snapshot, excluding credentials and personal data, was reviewed with a separate-lab Claude reviewer at high effort. The scoped run reached its eight-minute cap without returning findings or a verdict. This is **not a review pass**. Its stream is retained in `data/microsoft-cross-lab-review.jsonl`. Local validation proceeded, but no release-ready claim or public deployment was made. Minor subsequent changes (asset serving, mapping extraction, retry handling and additional tests) also remain without an independent verdict.

## Still requires live verification

Kelly must complete Microsoft OAuth consent using his own Hotmail/Outlook account. Then verify discovered calendars and event/attendee/meeting-link reads. Real Microsoft event create/edit/delete, recurring exceptions and organizational shared calendars have not been exercised; automated tests use fake transports and do not send invitations or change real meetings.

Microsoft online-meeting notes use the in-app rich-text editor, with generated meeting markup preserved on the backend. Full sync covers a bounded date window; see `microsoft-calendar.md` for behavior and setup details.

## In-app rich notes validation — September 9, 2026

Kelly connected Microsoft successfully and the real Microsoft event renders editable notes and one Teams join link. A temporary private online meeting (no attendees) was created through Graph, edited with formatted notes through the provider, fetched to verify the exact generated meeting block and online-meeting metadata survived, then cleared and fetched again. Both writes passed; the temporary event was deleted. New-meeting provisioning changed remote revisions during testing; stale writes were rejected and the test retried against fresh revisions. Browser checks cover formatted editing, links, lists, undo/redo, literal characters, unchanged-body preservation and desktop/tablet/phone layout. Earlier live-test limitations above describe the original integration checkpoint.

Current notes checks: 215 backend tests passed; 28 relevant browser cases passed across notes, event details/scheduling and MVP interactions. Production build passed. Screenshots: `output/rich-notes-desktop.png`, `output/rich-notes-1024.png`, `output/rich-notes-390.png`. Live test receipt: `data/rich-notes-live-result.json` (contains booleans only).

The independent Claude review found three defects: meeting-body details lost from the read view, overlapping separator spans accumulating markup, and prefixed meeting IDs not recognized. Each was confirmed and fixed with regression coverage. The full description is retained for preview, `editable_description` seeds the editor, and pending/successful writes retain generated details. The review used its bounded eight-minute budget; the fix delta was tested locally rather than starting another independent review.
