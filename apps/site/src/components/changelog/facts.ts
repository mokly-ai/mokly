/**
 * What the changelog page derives from the published releases: the names
 * and icons of the note groups, the dates in the page's words, the months of
 * Version history and every count the page draws. Each count is computed
 * from the notes, so the page states no number of its own. The names and the
 * icons are the ones that `design/site/changelog` draws.
 */

import type { GroupKind, GroupKindOrOther } from "../../changelog/groups.js";
import { noteText } from "../../changelog/notes.js";
import type { ReleaseGroup } from "../../changelog/parse.js";
import type { PublishedRelease } from "../../changelog/releases.js";
import type { IconName } from "../icons.js";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The names that one kind of note group takes on the page. */
interface GroupNames {
  /** The short name of a count chip and a filter option, such as `Fixes`. */
  readonly short: string;
  /** The heading of the group, such as `Bug fixes`. */
  readonly title: string;
}

/** The names of each note group that the page knows. */
export const GROUP_NAMES: Readonly<Record<GroupKind, GroupNames>> = {
  breaking: { short: "Breaking", title: "Breaking changes" },
  features: { short: "Features", title: "Features" },
  fixes: { short: "Fixes", title: "Bug fixes" },
  performance: { short: "Performance", title: "Performance improvements" },
  refactoring: { short: "Refactoring", title: "Code refactoring" },
  docs: { short: "Docs", title: "Documentation" },
  deps: { short: "Dependencies", title: "Dependencies" },
};

/** The icon of each note group, on its chip, its heading and its filter. */
export const GROUP_ICONS: Readonly<Record<GroupKindOrOther, IconName>> = {
  breaking: "alert",
  features: "feature",
  fixes: "fix",
  performance: "bolt",
  refactoring: "layers",
  docs: "file",
  deps: "cube",
  other: "tag",
};

/** How many of the newest releases draw as full frames; older ones are compact. */
export const FULL_FRAMES = 6;

/** A heading the page does not know, without the release tool's warning sign. */
function ownHeading(group: ReleaseGroup): string {
  return group.heading.replace(/^⚠\s*/u, "");
}

/** The heading of a group, such as `Bug fixes`. */
export function groupTitle(group: ReleaseGroup): string {
  return group.kind === "other"
    ? ownHeading(group)
    : GROUP_NAMES[group.kind].title;
}

/** The short name of a group's count chip, such as `Fixes`. */
export function groupShort(group: ReleaseGroup): string {
  return group.kind === "other"
    ? ownHeading(group)
    : GROUP_NAMES[group.kind].short;
}

/** The year, month and day of a `YYYY-MM-DD` date, read without a clock. */
function dateParts(date: string): { day: number; month: string; year: number } {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { day, month: MONTHS[month - 1] ?? "", year };
}

/** The short name of a date's month, such as `Nov`. */
export function shortMonth(date: string): string {
  return dateParts(date).month.slice(0, 3);
}

/** A release date in Version history, such as `12 Nov`. */
export function shortDate(date: string): string {
  return `${dateParts(date).day} ${shortMonth(date)}`;
}

/** The month that a release falls in, such as `November 2026`. */
export function monthOf(date: string): string {
  const { month, year } = dateParts(date);
  return `${month} ${year}`;
}

/**
 * The span from one release date to a later one, such as `15 September to
 * 8 October 2026`; the first date names its year only when the years differ.
 */
export function dateRange(from: string, to: string): string {
  const start = dateParts(from);
  const end = dateParts(to);
  const year = start.year === end.year ? "" : ` ${start.year}`;
  return `${start.day} ${start.month}${year} to ${end.day} ${end.month} ${end.year}`;
}

/** The compare range of a release link, such as `v0.18.0...v0.19.0`. */
export function compareRange(link: string | null): string | undefined {
  const at = link?.lastIndexOf("/compare/") ?? -1;
  return link === null || at < 0
    ? undefined
    : link.slice(at + "/compare/".length) || undefined;
}

/** Whether a release lists breaking changes. */
export function isBreaking(release: PublishedRelease): boolean {
  return release.groups.some((group) => group.kind === "breaking");
}

/** Whether a release is a patch release, such as `0.16.1`. */
export function isPatch(release: PublishedRelease): boolean {
  return Number(/^\d+\.\d+\.(\d+)/.exec(release.version)?.[1] ?? 0) > 0;
}

/** How many notes a release lists, in one kind of group or in all. */
export function noteCount(
  release: PublishedRelease,
  kind?: GroupKindOrOther,
): number {
  return release.groups
    .filter((group) => kind === undefined || group.kind === kind)
    .reduce((sum, group) => sum + group.notes.length, 0);
}

/** How many notes the releases list, in one kind of group or in all. */
export function totalNotes(
  releases: readonly PublishedRelease[],
  kind?: GroupKindOrOther,
): number {
  return releases.reduce((sum, release) => sum + noteCount(release, kind), 0);
}

/** A count with its noun, such as `1 note` or `22 notes`. */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The titles of a release's upgrade topics, in order. */
export function upgradeTopics(release: PublishedRelease): string[] {
  return release.upgrade.flatMap((topic) =>
    topic.title === undefined ? [] : [noteText(topic.title)],
  );
}

/** The releases grouped by the month they fall in, newest first. */
export function releaseMonths(
  releases: readonly PublishedRelease[],
): ReadonlyArray<{ month: string; releases: readonly PublishedRelease[] }> {
  const months: Array<{ month: string; releases: PublishedRelease[] }> = [];
  for (const release of releases) {
    const month = monthOf(release.date);
    const last = months.at(-1);
    if (last?.month === month) last.releases.push(release);
    else months.push({ month, releases: [release] });
  }
  return months;
}
