/**
 * The anchors of the changelog page. Each release, each of its note groups,
 * its upgrade notes and each upgrade topic and subtopic take an id that is
 * unique on the page, so that Version history, the count chips and a note's
 * own links can reach them. A note's fragment that names an upgrade heading
 * of the same release, as GitHub names it, such as
 * `#first-rust-core-release`, points at that heading's id on the page.
 */

import type { NoteItem, ReleaseNote } from "./items.js";
import { type NoteSegment, noteText } from "./notes.js";
import type { Release, ReleaseGroup } from "./parse.js";
import type { UpgradeBlock, UpgradeTopic } from "./upgrade.js";

/** A note group with its anchor. */
export interface AnchoredGroup extends ReleaseGroup {
  readonly id: string;
}

/** A block of the upgrade notes; a subtopic heading carries its anchor. */
export type AnchoredBlock =
  | Exclude<UpgradeBlock, { kind: "subtopic" }>
  | (Extract<UpgradeBlock, { kind: "subtopic" }> & { readonly id: string });

/** An upgrade topic with its anchor; a topic without a title has none. */
export interface AnchoredTopic extends Omit<UpgradeTopic, "blocks"> {
  readonly blocks: readonly AnchoredBlock[];
  readonly id: string | undefined;
}

/** A release with the anchors of its frame, its title and its parts. */
export interface AnchoredRelease extends Omit<Release, "groups" | "upgrade"> {
  /** The id of the release frame, such as `release-0-19-0`. */
  readonly anchor: string;
  readonly groups: readonly AnchoredGroup[];
  /** The id of the release's heading, which names its frame. */
  readonly titleId: string;
  readonly upgrade: readonly AnchoredTopic[];
  /** The id of the upgrade notes, such as `release-0-16-0-upgrade`. */
  readonly upgradeId: string;
}

/** The anchor a release takes on the changelog page. */
export function releaseAnchor(version: string): string {
  return `release-${version.replace(/[^0-9a-z]+/gi, "-").toLowerCase()}`;
}

/**
 * A heading's fragment as GitHub derives it: lowercase, without punctuation,
 * with each space a hyphen.
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** `base`, or `base-2`, `base-3` and so on: the first id not yet taken. */
function claim(base: string, taken: Set<string>): string {
  let id = base;
  for (let count = 2; taken.has(id); count += 1) id = `${base}-${count}`;
  taken.add(id);
  return id;
}

/** The segments with each fragment that names a heading pointed at its id. */
function point(
  segments: readonly NoteSegment[],
  targets: ReadonlyMap<string, string>,
): readonly NoteSegment[] {
  return segments.map((segment) => {
    if (segment.kind !== "link" || !segment.href.startsWith("#"))
      return segment;
    const id = targets.get(segment.href.slice(1));
    return id === undefined ? segment : { ...segment, href: `#${id}` };
  });
}

function pointItems(
  items: readonly NoteItem[],
  targets: ReadonlyMap<string, string>,
): readonly NoteItem[] {
  return items.map((item) => ({
    items: pointItems(item.items, targets),
    text: point(item.text, targets),
  }));
}

function pointNote(
  note: ReleaseNote,
  targets: ReadonlyMap<string, string>,
): ReleaseNote {
  return {
    ...note,
    items: pointItems(note.items, targets),
    text: point(note.text, targets),
  };
}

/** The id of a group: its kind, or its own heading for an unknown kind. */
function groupBase(anchor: string, group: ReleaseGroup): string {
  const name = group.kind === "other" ? headingSlug(group.heading) : group.kind;
  return `${anchor}-${name || "notes"}`;
}

/**
 * One release's anchors; `taken` holds every id the page has given out. The
 * groups claim their ids first, then each topic and its subtopics in order.
 */
function anchored(release: Release, taken: Set<string>): AnchoredRelease {
  const anchor = releaseAnchor(release.version);
  const titleId = claim(`${anchor}-title`, taken);
  const groupIds = release.groups.map((group) =>
    claim(groupBase(anchor, group), taken),
  );
  const upgradeId = claim(`${anchor}-upgrade`, taken);
  const targets = new Map<string, string>();
  const heading = (title: readonly NoteSegment[]): string => {
    const slug = headingSlug(noteText(title));
    const id = claim(`${upgradeId}-${slug || "topic"}`, taken);
    if (slug && !targets.has(slug)) targets.set(slug, id);
    return id;
  };
  const topics = release.upgrade.map((topic) => {
    const id = topic.title === undefined ? undefined : heading(topic.title);
    const blocks = topic.blocks.map((block) =>
      block.kind === "subtopic"
        ? { ...block, id: heading(block.title) }
        : block,
    );
    return { blocks, id, title: topic.title };
  });
  return {
    anchor,
    date: release.date,
    groups: release.groups.map((group, at) => ({
      ...group,
      id: groupIds[at] ?? anchor,
      notes: group.notes.map((note) => pointNote(note, targets)),
    })),
    link: release.link,
    titleId,
    upgrade: topics.map((topic) => ({
      blocks: topic.blocks.map((block): AnchoredBlock => {
        if (block.kind === "list")
          return { ...block, items: pointItems(block.items, targets) };
        if (block.kind === "paragraph")
          return { ...block, text: point(block.text, targets) };
        return { ...block, title: point(block.title, targets) };
      }),
      id: topic.id,
      title:
        topic.title === undefined ? undefined : point(topic.title, targets),
    })),
    upgradeId,
    version: release.version,
  };
}

/**
 * Every release with its anchors, in the given order. The release anchors
 * come first, so a release keeps its anchor whatever its parts are called.
 */
export function anchorReleases(
  releases: readonly Release[],
): readonly AnchoredRelease[] {
  const taken = new Set(
    releases.map((release) => releaseAnchor(release.version)),
  );
  return releases.map((release) => anchored(release, taken));
}
