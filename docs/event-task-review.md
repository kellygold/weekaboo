# Event and task interaction review — 9 September 2026

The provider-metadata and interaction changes received a bounded, read-only Claude review of an isolated snapshot. Local raw evidence: `data/event-cross-lab-review.jsonl` (ignored). The review found two confirmed defects:

- Today reordering included completed task IDs even though display order moved them below unfinished tasks. Reordering now operates only on unfinished IDs, preserving completed ranks for restoration.
- Changing a scheduled task's day with an empty/invalid end time could throw before saving the new day. Date conversion now checks validity and falls back to a 30-minute block; submission also rejects invalid timestamps.

Both fixes have browser regression tests. The later date/time picker, fit-to-viewport zoom, empty-grid drafting, inline Anytime expansion and provider URL-encoding fix were not part of that independent snapshot. They received local automated validation and visual inspection; this is not an unconditional release sign-off.

Provider metadata is read-only: meeting URLs, original event links and attendee responses are cached and returned but never added to editable provider payloads. Migration adds the three nullable columns transactionally and resets sync cursors once for backfill, preserving pending writes. A backup preceded the live migration. Live Product Sync now includes its Google Meet URL and six guests (five accepted, one declined).

The live refresh also exposed opaque Google calendar IDs containing reserved URL characters. Path segments now use percent encoding; an HTTP transport regression test covers those characters. The successful refresh pulled 5,536 changes and pushed none.

Validation: backend suite 169 passing tests; browser suite covers preview content/links, task schedule and resize, date/time choices, completion history, account removal, zoom geometry, inline overflow and reorder restoration. Provider writes and deletes use test transports; real user events were not created, edited or deleted for validation. Physical Android/iPhone testing remains outstanding.
