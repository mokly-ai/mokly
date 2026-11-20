/**
 * What the changelog derives from the depicted releases: each release's
 * anchor, its dates in the page's words, the months of Version history, the
 * names of its note groups and every count the page draws. Each count is
 * computed from the depicted notes, so the page states no number of its own.
 */

import type { SiteIconName } from "./icons.js";
import type { Release, ReleaseGroupKind } from "./release";

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
  short: string;
  /** The heading of the group, such as `Bug fixes`. */
  title: string;
}

/** The names of each note group, in the changelog's order. */
export const GROUP_NAMES: Readonly<Record<ReleaseGroupKind, GroupNames>> = {
  breaking: { short: "Breaking", title: "Breaking changes" },
  features: { short: "Features", title: "Features" },
  fixes: { short: "Fixes", title: "Bug fixes" },
  performance: { short: "Performance", title: "Performance improvements" },
  refactoring: { short: "Refactoring", title: "Code refactoring" },
  docs: { short: "Docs", title: "Documentation" },
  deps: { short: "Dependencies", title: "Dependencies" },
};

/** The icon of each note group, on its chip, its heading and its filter. */
export const GROUP_ICONS: Readonly<Record<ReleaseGroupKind, SiteIconName>> = {
  breaking: "alert",
  features: "feature",
  fixes: "fix",
  performance: "bolt",
  refactoring: "layers",
  docs: "file",
  deps: "cube",
};

/** How many of the newest releases draw as full frames; older ones are compact. */
export const FULL_FRAMES = 6;

/** The note groups that the filter offers after All. */
export const FILTER_GROUPS: readonly ReleaseGroupKind[] = [
  "breaking",
  "features",
  "fixes",
  "performance",
];

/** The year, month and day of a `YYYY-MM-DD` date, read without a clock. */
function dateParts(date: string): { day: number; month: string; year: number } {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { day, month: MONTHS[month - 1] ?? "", year };
}

/** The in-page anchor of a release frame, such as `release-0-19-0`. */
export function releaseId(release: Release): string {
  return `release-${release.version.replaceAll(".", "-")}`;
}

/**
 * The anchor of one note group of a release, such as `release-0-19-0-fixes`,
 * or of its upgrade notes, such as `release-0-16-0-upgrade`.
 */
export function groupId(
  release: Release,
  kind: ReleaseGroupKind | "upgrade",
): string {
  return `${releaseId(release)}-${kind}`;
}

/** The topics of a release's upgrade notes: the names of its `####` headings. */
export function upgradeTopics(release: Release): string[] {
  return (release.upgrade ?? [])
    .filter((block) => block.startsWith("#### "))
    .map((block) => block.slice("#### ".length));
}

/** A release date in full, such as `12 November 2026`. */
export function readableDate(date: string): string {
  const { day, month, year } = dateParts(date);
  return `${day} ${month} ${year}`;
}

/** The short name of a date's month, such as `Nov`. */
export function shortMonth(date: string): string {
  return dateParts(date).month.slice(0, 3);
}

/** A release date in Version history, such as `12 Nov`. */
export function shortDate(date: string): string {
  return `${dateParts(date).day} ${shortMonth(date)}`;
}

/**
 * The span from one release date to a later one, such as `15 September to
 * 8 October 2026`; the first date names its year only when the years differ.
 */
export function dateRange(from: string, to: string): string {
  const start = dateParts(from);
  const year = start.year === dateParts(to).year ? "" : ` ${start.year}`;
  return `${start.day} ${start.month}${year} to ${readableDate(to)}`;
}

/** The month that a release falls in, such as `November 2026`. */
export function monthOf(date: string): string {
  const { month, year } = dateParts(date);
  return `${month} ${year}`;
}

/** The compare range of the heading's link, such as `v0.18.0...v0.19.0`. */
export function compareRange(release: Release): string {
  return release.compare.slice(release.compare.lastIndexOf("/") + 1);
}

/** Whether a release lists breaking changes. */
export function isBreaking(release: Release): boolean {
  return release.groups.some((group) => group.kind === "breaking");
}

/** Whether a release is a patch release, such as `0.16.1`. */
export function isPatch(release: Release): boolean {
  return !release.version.endsWith(".0");
}

/** How many notes a release lists, in one kind of group or in all. */
export function noteCount(release: Release, kind?: ReleaseGroupKind): number {
  return release.groups
    .filter((group) => kind === undefined || group.kind === kind)
    .reduce((sum, group) => sum + group.notes.length, 0);
}

/** How many notes the releases list, in one kind of group or in all. */
export function totalNotes(
  releases: readonly Release[],
  kind?: ReleaseGroupKind,
): number {
  return releases.reduce((sum, release) => sum + noteCount(release, kind), 0);
}

/** A count with its noun, such as `1 note` or `22 notes`. */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The releases grouped by the month they fall in, newest first. */
export function releaseMonths(
  releases: readonly Release[],
): ReadonlyArray<{ month: string; releases: readonly Release[] }> {
  const months: Array<{ month: string; releases: Release[] }> = [];
  for (const release of releases) {
    const month = monthOf(release.date);
    const last = months.at(-1);
    if (last?.month === month) last.releases.push(release);
    else months.push({ month, releases: [release] });
  }
  return months;
}

/** Days from 1 January 1970 to a `YYYY-MM-DD` date, in UTC. */
export function dayNumber(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
