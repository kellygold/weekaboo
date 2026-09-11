"""Keep Microsoft's generated meeting HTML separate from editable event notes.

Ranges refer to the original source: protected blocks are copied byte-for-byte,
not parsed and reserialized. The latest Graph body is used on every write.
"""

import re
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit

from .providers.base import ProviderError

VOID = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


@dataclass
class Node:
    tag: str
    attrs: dict
    start: int
    content_start: int
    end: int = 0
    close_start: int = 0
    parent: "Node | None" = None
    children: list["Node"] = field(default_factory=list)


class BodyParser(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0]
        for line in source.split("\n"):
            self.lines.append(self.lines[-1] + len(line) + 1)
        self.nodes: list[Node] = []
        self.stack: list[Node] = []
        self.feed(source)
        self.close()

    def source_offset(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.source_offset()
        node = Node(
            tag,
            dict(attrs),
            start,
            start + len(self.get_starttag_text()),
            parent=self.stack[-1] if self.stack else None,
        )
        if node.parent:
            node.parent.children.append(node)
        self.nodes.append(node)
        if tag in VOID:
            node.end = node.close_start = node.content_start
        else:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            node = self.stack.pop()
            node.end = node.close_start = node.content_start

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].tag == tag:
                node = self.stack[index]
                node.close_start = self.source_offset()
                node.end = self.source.find(">", node.close_start) + 1
                del self.stack[index:]
                break

    def protected(self):
        candidates = []
        for node in self.nodes:
            classes = {
                c.removeprefix("x_") for c in (node.attrs.get("class") or "").split()
            }
            identity = (node.attrs.get("id") or "").lower().removeprefix("x_")
            if "me-email-text" in classes or identity in {
                "skypemeeting",
                "teamsmeeting",
                "skypemeetingcontent",
            }:
                if not node.end:
                    raise ProviderError(
                        422,
                        "The meeting details are incomplete. Notes have not been sent; sync and try again.",
                    )
                # Only outermost marked blocks; nested markers must not duplicate.
                if not any(
                    parent.start <= node.start < parent.end for parent in candidates
                ):
                    candidates.append(node)
        # Outlook puts decorative separator divs beside its generated block.
        # Keep those with the block rather than making them editable notes.
        for node in candidates:
            siblings = (
                node.parent.children
                if node.parent
                else [n for n in self.nodes if n.parent is None]
            )
            index = siblings.index(node)
            for neighbor in reversed(siblings[:index]):
                if self.source[neighbor.end : node.start].strip() or not self.separator(
                    neighbor
                ):
                    break
                node.start = neighbor.start
            for neighbor in siblings[index + 1 :]:
                if self.source[node.end : neighbor.start].strip() or not self.separator(
                    neighbor
                ):
                    break
                node.end = neighbor.end
        # Adjacent blocks can both absorb the same separator. Make the ranges
        # disjoint so repeated writes cannot multiply that markup.
        for previous, current in zip(candidates, candidates[1:]):
            current.start = max(current.start, previous.end)
        return candidates

    def separator(self, node):
        if not node.end or node.tag not in {"div", "p", "br", "hr"}:
            return False
        raw = self.source[node.start : node.end]
        if re.search(r"<(?:a|img|input)\b", raw, re.I):
            return False
        text = unescape(re.sub(r"<[^>]*>", "", raw)).strip()
        return not text or bool(re.fullmatch(r"[_—–\-\s]+", text))

    def join_link(self):
        for node in self.nodes:
            if node.tag != "a":
                continue
            try:
                url = urlsplit(node.attrs.get("href") or "")
                if url.hostname in {
                    "teams.live.com",
                    "teams.microsoft.com",
                    "join.skype.com",
                } and (
                    "/meet/" in url.path
                    or "/meetup-join/" in url.path
                    or url.hostname == "join.skype.com"
                ):
                    if (
                        url.scheme in {"http", "https"}
                        and not url.username
                        and not url.password
                    ):
                        return node.attrs["href"]
            except ValueError:
                continue
        return None

    def body_range(self):
        body = next((n for n in self.nodes if n.tag == "body" and n.end), None)
        return (body.content_start, body.close_start) if body else (0, len(self.source))


def editable_notes(source: str | None) -> str | None:
    if not source:
        return source
    parsed = BodyParser(source)
    try:
        blocks = parsed.protected()
    except ProviderError:
        # A malformed provider body must not break calendar reads. Writes still
        # fail closed when merging into that same incomplete body.
        return source
    if not blocks:
        return source
    start, end = parsed.body_range()
    pieces = []
    for block in blocks:
        pieces.append(source[start : block.start])
        start = block.end
    pieces.append(source[start:end])
    return "".join(pieces).strip()


def merge_notes(latest_body: str, notes: str | None, *, online: bool) -> str:
    parsed = BodyParser(latest_body)
    blocks = parsed.protected()
    if online and not blocks and parsed.join_link():
        # Unknown templates must never be guessed at and overwrite joining data.
        raise ProviderError(
            422,
            "This meeting uses an unrecognized details format. Your draft is still here; the remote meeting has not been changed.",
        )
    clean = editable_notes(notes) or ""
    if not blocks:
        return clean
    start, end = parsed.body_range()
    protected_html = "".join(latest_body[node.start : node.end] for node in blocks)
    return latest_body[:start] + clean + protected_html + latest_body[end:]


def meeting_link(source: str | None) -> str | None:
    """Keep a join action for invitations whose only call link is in the body."""
    return BodyParser(source).join_link() if source else None
