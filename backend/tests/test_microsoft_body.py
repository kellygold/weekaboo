from copy import deepcopy

import pytest

from weekaboo.integrations.microsoft_body import editable_notes, merge_notes
from weekaboo.integrations.providers.base import ProviderError

BLOB = '<div class="me-email-text" style="color:#222"><b>Microsoft Teams</b><a href="https://teams.live.com/meet/123?p=fake&amp;x=1">Join</a><p>Passcode: fake</p></div>'
WRAPPED = (
    '<html><head><meta charset="utf-8"></head><body><p>Original notes</p><div>________</div>'
    + BLOB
    + "<div>&nbsp;</div></body></html>"
)


def test_extract_notes_and_keep_exact_meeting_blob_when_replacing():
    assert editable_notes(WRAPPED) == "<p>Original notes</p>"
    result = merge_notes(WRAPPED, "<p>New <b>formatted</b> notes</p>", online=True)
    assert result == WRAPPED.replace(
        "<p>Original notes</p>", "<p>New <b>formatted</b> notes</p>"
    )
    assert merge_notes(result, "<p>Next revision</p>", online=True).count(BLOB) == 1
    assert editable_notes(merge_notes(result, None, online=True)) == ""


def test_preserves_notes_after_meeting_and_multiple_blocks():
    source = "<p>Before</p>" + BLOB + "<p>After</p>"
    assert editable_notes(source) == "<p>Before</p><p>After</p>"
    nested = '<div id="TeamsMeeting">' + BLOB + "</div>"
    assert merge_notes(nested, "<p>New</p>", online=True) == "<p>New</p>" + nested
    assert merge_notes(source + BLOB, "new", online=True).count(BLOB) == 2


def test_unknown_online_template_is_not_overwritten():
    with pytest.raises(ProviderError, match="unrecognized"):
        merge_notes(
            '<p>Important</p><a href="https://teams.live.com/meet/123">Join</a>',
            "new",
            online=True,
        )
    with pytest.raises(ProviderError, match="incomplete"):
        merge_notes('<div class="me-email-text">truncated', "new", online=True)


def test_plain_event_notes_and_crlf_source_ranges():
    assert merge_notes("<p>Old</p>", "<p>New</p>", online=False) == "<p>New</p>"
    source = WRAPPED.replace("<body>", "<body>\r\n")
    assert BLOB in merge_notes(source, "<p>New</p>", online=True)
    assert editable_notes(source) == "<p>Original notes</p>"


def test_malformed_body_is_readable_but_cannot_be_overwritten():
    source = '<p>My notes</p><div class="me-email-text">Truncated'
    assert editable_notes(source) == source
    with pytest.raises(ProviderError):
        merge_notes(source, '<p>New</p>', online=True)


def test_shared_separators_do_not_multiply_on_repeated_saves():
    source = BLOB + '<div>________</div>' + BLOB
    for _ in range(5):
        source = merge_notes(source, '<p>New notes</p>', online=True)
        assert source.count('________') == 1
        assert source.count(BLOB) == 2
        assert editable_notes(source) == '<p>New notes</p>'


def test_outlook_prefixed_id_is_protected_even_on_forwarded_offline_invite():
    source = '<p>Notes</p><div id="x_teamsMeeting">Dial-in 1234</div>'
    assert editable_notes(source) == '<p>Notes</p>'
    assert merge_notes(source, 'New', online=False) == 'New<div id="x_teamsMeeting">Dial-in 1234</div>'
