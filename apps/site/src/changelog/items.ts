/**
 * One note of a release as the release tool writes it: an optional bold
 * scope, the text with its code spans and links, the issue and commit links
 * in parentheses at its end, and nested items on indented lines below it,
 * such as a workspace dependency bump. The upgrade notes' lists use the same
 * nested items.
 */

import { type LinkResolver, type NoteSegment, parseNote } from "./notes.js";

/** An issue link such as `#285`, or a commit link such as `7058b0d`. */
export interface NoteRef {
  readonly href: string;
  readonly kind: "commit" | "issue";
  readonly label: string;
}

/** A list item, with the items nested under it. */
export interface NoteItem {
  readonly items: readonly NoteItem[];
  readonly text: readonly NoteSegment[];
}

/** One note of a release. */
export interface ReleaseNote {
  /** The nested items under the note. */
  readonly items: readonly NoteItem[];
  /** The issue and commit links at the end of the note, in their order. */
  readonly refs: readonly NoteRef[];
  /** The scope of the bold label that leads the note, such as `viewer`. */
  readonly scope: string | undefined;
  /** The note's text, without its scope and its issue and commit links. */
  readonly text: readonly NoteSegment[];
}

/** The bold scope that leads a note, such as `**viewer:** `. */
const SCOPE = /^\*\*([^*]+):\*\* /;

/** One issue or commit link at the end of a note, such as ` ([#285](…))`. */
const REF = / \(\[([^\]]+)\]\(([^)\s]+)\)\)$/;

/** A short or full commit hash, the label of a commit link. */
const COMMIT = /^[0-9a-f]{7,40}$/;

/** A list item's line: its indentation, its `*` or `-` marker and its text. */
const ITEM = /^(\s*)[*-] (.*)$/;

/** An item while its lines are read. */
interface Draft {
  readonly depth: number;
  readonly items: Draft[];
  readonly lines: string[];
}

/**
 * Nest list items by their indentation under `root`. A line that is not an
 * item continues the text of the item before it, and of `root` before the
 * first item.
 */
function nest(root: Draft, lines: readonly string[]): Draft {
  const open: Draft[] = [root];
  for (const line of lines) {
    const match = ITEM.exec(line);
    if (match === null) {
      if (line.trim().length > 0) open.at(-1)?.lines.push(line.trim());
      continue;
    }
    const depth = (match[1] ?? "").length;
    while (open.length > 1 && (open.at(-1)?.depth ?? -1) >= depth) open.pop();
    const item: Draft = { depth, items: [], lines: [(match[2] ?? "").trim()] };
    open.at(-1)?.items.push(item);
    open.push(item);
  }
  return root;
}

function itemOf(draft: Draft, resolve: LinkResolver): NoteItem {
  return {
    items: draft.items.map((item) => itemOf(item, resolve)),
    text: parseNote(draft.lines.join(" "), resolve),
  };
}

/** The items of a list, from the Markdown lines of its items. */
export function readItems(
  lines: readonly string[],
  resolve: LinkResolver,
): readonly NoteItem[] {
  return nest({ depth: -1, items: [], lines: [] }, lines).items.map((item) =>
    itemOf(item, resolve),
  );
}

/**
 * One note, from the text of its item without the list marker and the lines
 * that follow it: the lines that continue its text, then its nested items.
 */
export function readNote(
  text: string,
  lines: readonly string[],
  resolve: LinkResolver,
): ReleaseNote {
  const root = nest({ depth: -1, items: [], lines: [text.trim()] }, lines);
  let body = root.lines.join(" ").trim();
  const scope = SCOPE.exec(body);
  if (scope !== null) body = body.slice(scope[0].length);
  const refs: NoteRef[] = [];
  for (let ref = REF.exec(body); ref !== null; ref = REF.exec(body)) {
    const [, label = "", destination = ""] = ref;
    const href = resolve(destination);
    if (href === undefined) break;
    refs.unshift({
      href,
      kind: COMMIT.test(label) ? "commit" : "issue",
      label,
    });
    body = body.slice(0, ref.index);
  }
  return {
    items: root.items.map((item) => itemOf(item, resolve)),
    refs,
    scope: scope?.[1],
    text: parseNote(body, resolve),
  };
}
