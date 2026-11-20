/**
 * One note of a release, drawn from the Markdown that the release tool wrote:
 * the scope as a mono chip, the text with its code spans, and the issue and
 * commit links, which stay links. A link inside the text points at a page
 * that no mockup owns, so it renders as its text. Nested items, such as a
 * workspace dependency bump, draw as a small layer tree under the note.
 */

import { Fragment, type ReactNode } from "react";

import { SiteIcon } from "./icons.js";

/** A link of a note: an issue such as `#285` or a commit such as `7058b0d`. */
interface NoteRef {
  href: string;
  label: string;
}

/** A nested item of a note, with the items nested under it. */
interface NoteItem {
  items: NoteItem[];
  text: string;
}

/** The bold scope that leads a note, such as `**viewer:** `. */
const SCOPE = /^\*\*([^*]+):\*\* /;

/** One issue or commit link at the end of a note, such as ` ([#285](…))`. */
const REF = / \(\[([^\]]+)\]\((https:[^)\s]+)\)\)$/;

/** A code span, or a link whose text the note keeps. */
const PIECE = /`([^`]+)`|\[([^\]]+)\]\([^)\s]+\)/g;

/** A short commit hash, the label of a commit link. */
const COMMIT = /^[0-9a-f]{7}$/;

/**
 * The text of a note, an item or an upgrade note: its code spans, and its
 * links as text, because no mockup owns their pages.
 */
export function NoteText({ text }: { text: string }) {
  const pieces: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(PIECE)) {
    pieces.push(text.slice(at, match.index));
    pieces.push(
      match[1] === undefined ? (
        match[2]
      ) : (
        <code key={match.index}>{match[1]}</code>
      ),
    );
    at = match.index + match[0].length;
  }
  pieces.push(text.slice(at));
  return <span className="site-release-note-text">{pieces}</span>;
}

/** The nested items under a note, from their indented Markdown lines. */
function nestedItems(lines: readonly string[]): NoteItem[] {
  const root: NoteItem = { items: [], text: "" };
  const open: Array<{ depth: number; item: NoteItem }> = [
    { depth: 0, item: root },
  ];
  for (const line of lines) {
    const match = /^( +)\* (.+)$/.exec(line);
    if (!match) continue;
    const depth = (match[1] ?? "").length;
    while (open.length > 1 && (open.at(-1)?.depth ?? 0) >= depth) open.pop();
    const item: NoteItem = { items: [], text: match[2] ?? "" };
    open.at(-1)?.item.items.push(item);
    open.push({ depth, item });
  }
  return root.items;
}

/** A layer tree of nested items. */
function NoteTree({ items }: { items: readonly NoteItem[] }) {
  return (
    <ul className="site-release-tree">
      {items.map((item) => (
        <li key={item.text}>
          <NoteText text={item.text} />
          {item.items.length === 0 ? null : <NoteTree items={item.items} />}
        </li>
      ))}
    </ul>
  );
}

/** An issue link, or a commit link with its icon and a spoken name. */
function NoteLink({ reference }: { reference: NoteRef }) {
  if (!COMMIT.test(reference.label))
    return (
      <a className="site-release-ref" href={reference.href}>
        {reference.label}
      </a>
    );
  return (
    <a
      aria-label={`Commit ${reference.label}`}
      className="site-release-ref site-release-ref--commit"
      href={reference.href}
    >
      <SiteIcon name="commit" size={14} />
      {reference.label}
    </a>
  );
}

/** One note: its scope, its text, its links and its nested items. */
export function ReleaseNote({ markdown }: { markdown: string }) {
  const [line = "", ...nested] = markdown.split("\n");
  const scope = SCOPE.exec(line)?.[1];
  let text = scope === undefined ? line : line.replace(SCOPE, "");
  const references: NoteRef[] = [];
  for (let match = REF.exec(text); match; match = REF.exec(text)) {
    references.unshift({ href: match[2] ?? "", label: match[1] ?? "" });
    text = text.slice(0, match.index);
  }
  const items = nestedItems(nested);
  return (
    <li>
      <span className="site-release-note-body">
        {scope === undefined ? null : (
          <>
            <span className="site-release-scope">
              {scope}
              <span className="site-visually-hidden">:</span>
            </span>{" "}
          </>
        )}
        <NoteText text={text} />
      </span>
      {references.length === 0 ? null : (
        <>
          {" "}
          <span className="site-release-refs">
            {references.map((reference, index) => (
              <Fragment key={reference.label}>
                {index === 0 ? null : " "}
                <NoteLink reference={reference} />
              </Fragment>
            ))}
          </span>
        </>
      )}
      {items.length === 0 ? null : <NoteTree items={items} />}
    </li>
  );
}
