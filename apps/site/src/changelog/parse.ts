/**
 * Parse `CHANGELOG.md` into typed releases. The file is written by the
 * release tool, so its shape is fixed: a level-two heading names the version,
 * its release or compare link and the release date, level-three headings
 * group the notes, and every note is one list item. A release may close with
 * `### Upgrade Notes`, which the parser reads in full. The parser never
 * guesses a date or invents a title. A level-two heading that names a version
 * but not a date fails the build, so a malformed release can never be
 * published with the wrong facts; a heading that names no version at all is
 * prose the file keeps beside its releases and is skipped with everything
 * under it.
 */

import { type GroupKindOrOther, groupKind } from "./groups.js";
import { type ReleaseNote, readNote } from "./items.js";
import { type LinkResolver, publishedHref } from "./notes.js";
import { type UpgradeTopic, readUpgrade } from "./upgrade.js";

/** One group of notes inside a release, such as Features or Bug fixes. */
export interface ReleaseGroup {
  /** The heading as the release tool wrote it, such as `Bug Fixes`. */
  readonly heading: string;
  readonly kind: GroupKindOrOther;
  readonly notes: readonly ReleaseNote[];
}

/** One published release of the Mokly CLI. */
export interface Release {
  readonly date: string;
  /** The note groups, in the changelog's order. */
  readonly groups: readonly ReleaseGroup[];
  readonly link: string | null;
  /** The topics of the upgrade notes; none when the release has none. */
  readonly upgrade: readonly UpgradeTopic[];
  readonly version: string;
}

/** A `CHANGELOG.md` the site cannot publish without guessing. */
export class ChangelogError extends Error {
  constructor(line: string) {
    super(
      `The changelog heading ${JSON.stringify(line)} does not name a version, a link and a release date.`,
    );
    this.name = "ChangelogError";
  }
}

const LINKED = /^## \[([^\]]+)\]\(([^)\s]+)\) \((\d{4}-\d{2}-\d{2})\)\s*$/;
const PLAIN = /^## ([^[\s]+) \((\d{4}-\d{2}-\d{2})\)\s*$/;
const VERSIONED = /^## \[?v?\d+\.\d+/;
const UPGRADE = /^upgrade notes$/i;

/** The heading of the group that notes before any group heading join. */
const UNGROUPED = "Changes";

/** A note while its lines are read: its first line and the lines below it. */
interface NoteDraft {
  readonly lines: string[];
  readonly text: string;
}

/** A group while its notes are read. */
interface GroupDraft {
  readonly heading: string;
  readonly kind: GroupKindOrOther;
  readonly notes: NoteDraft[];
}

/** A release while its sections are read. */
interface Draft {
  readonly date: string;
  readonly groups: GroupDraft[];
  readonly link: string | null;
  readonly upgrade: string[];
  readonly version: string;
}

/**
 * The group that a heading opens. A second heading of a kind that the
 * release already lists, or a second unknown heading with the same words,
 * continues that group, so the release keeps one group of each kind.
 */
function openGroup(draft: Draft, raw: string): GroupDraft {
  const heading = raw.trim();
  const kind = groupKind(heading);
  const found = draft.groups.find((group) =>
    kind === "other"
      ? group.kind === "other" && group.heading === heading
      : group.kind === kind,
  );
  if (found !== undefined) return found;
  const group: GroupDraft = { heading, kind, notes: [] };
  draft.groups.push(group);
  return group;
}

function release(draft: Draft, resolve: LinkResolver): Release {
  return {
    date: draft.date,
    groups: draft.groups
      .filter((group) => group.notes.length > 0)
      .map((group) => ({
        heading: group.heading,
        kind: group.kind,
        notes: group.notes.map((note) =>
          readNote(note.text, note.lines, resolve),
        ),
      })),
    link: draft.link,
    upgrade: readUpgrade(draft.upgrade, resolve),
    version: draft.version,
  };
}

/** The release that a level-two heading opens, or none for a prose heading. */
function opened(line: string): Draft | undefined {
  const match = LINKED.exec(line) ?? PLAIN.exec(line);
  if (!match) {
    if (VERSIONED.test(line)) throw new ChangelogError(line);
    return undefined;
  }
  const [, first, second, third] = match;
  return {
    date: third ?? second ?? "",
    groups: [],
    link: third === undefined ? null : (second ?? null),
    upgrade: [],
    version: first ?? "",
  };
}

/**
 * Every release in the file, newest first, in the order the file lists.
 * `resolve` decides where each note link may lead; by default a link keeps
 * a site path, a fragment or an HTTP(S) address.
 */
export function parseChangelog(
  source: string,
  resolve: LinkResolver = publishedHref,
): readonly Release[] {
  const releases: Release[] = [];
  let draft: Draft | undefined;
  let group: GroupDraft | undefined;
  let note: NoteDraft | undefined;
  let upgrade = false;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      if (draft) releases.push(release(draft, resolve));
      draft = opened(line);
      group = undefined;
      note = undefined;
      upgrade = false;
      continue;
    }
    if (!draft) continue;
    if (line.startsWith("### ")) {
      note = undefined;
      upgrade = UPGRADE.test(line.slice(4).trim());
      group = upgrade ? undefined : openGroup(draft, line.slice(4));
      continue;
    }
    if (upgrade) {
      draft.upgrade.push(line);
      continue;
    }
    if (/^[*-] /.test(line)) {
      group ??= openGroup(draft, UNGROUPED);
      note = { lines: [], text: line.slice(2) };
      group.notes.push(note);
      continue;
    }
    if (note && line.trim().length > 0) note.lines.push(line);
    else note = undefined;
  }
  if (draft) releases.push(release(draft, resolve));
  return releases;
}
