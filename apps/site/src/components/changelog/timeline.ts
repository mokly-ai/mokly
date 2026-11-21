/**
 * The geometry of the release timeline, a keyframe track like the timeline
 * of a motion tool. The ruler spans the months of the releases, with a tick
 * for each month and week; each release is a keyframe at its date. A
 * keyframe that would touch another takes a lower lane, at most three. The
 * track is narrower in the mobile composition, so keyframes need more days
 * between them to share a lane there, and each keyframe has a lane in each
 * composition. Positions are percentages of the track.
 */

import type { PublishedRelease } from "../../changelog/releases.js";

import { shortMonth } from "./facts.js";

/** The most lanes the keyframes take. */
const LANES = 3;

/** The height of a lane and the centre of the first, in pixels. */
export const LANE_HEIGHT = 18;
export const FIRST_LANE = 16;

/**
 * How many days two keyframes need between them to share a lane: the
 * desktop track gives a day about 11px, the mobile track about 3.6px, and a
 * keyframe is about 16px wide.
 */
const LANE_GAP = { narrow: 5, wide: 2 } as const;

/** A tick of the ruler, with the month's name when it starts a month. */
export interface Tick {
  readonly label: string | undefined;
  readonly x: number;
}

/** A keyframe, with its lane in each composition. */
export interface Keyframe {
  readonly lanes: { readonly narrow: number; readonly wide: number };
  readonly release: PublishedRelease;
  readonly x: number;
}

/** The ruler, the keyframes and the lane count of each composition. */
export interface Timeline {
  readonly keyframes: readonly Keyframe[];
  readonly lanes: { readonly narrow: number; readonly wide: number };
  readonly ticks: readonly Tick[];
}

/** Days from 1 January 1970 to a `YYYY-MM-DD` date, in UTC. */
function dayNumber(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** A month of a `YYYY-MM-DD` date, counted from year 0. */
function monthIndex(date: string): number {
  const [year = 0, month = 1] = date.split("-").map(Number);
  return year * 12 + month - 1;
}

/**
 * The first day of each month from the oldest release's month to the month
 * after the newest release's, which closes the ruler.
 */
function monthStarts(oldest: string, newest: string): string[] {
  const starts: string[] = [];
  for (let month = monthIndex(oldest); month <= monthIndex(newest) + 1; month++)
    starts.push(
      `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}-01`,
    );
  return starts;
}

/** The lane of each keyframe, oldest first, for one day gap. */
function lanesFor(days: readonly number[], gap: number): number[] {
  const ends: number[] = [];
  return days.map((day) => {
    let lane = ends.findIndex((end) => day - end >= gap);
    if (lane < 0 && ends.length < LANES) lane = ends.length;
    if (lane < 0) lane = ends.indexOf(Math.min(...ends));
    ends[lane] = day;
    return lane;
  });
}

/** The timeline of the releases, which are newest first. */
export function timeline(releases: readonly PublishedRelease[]): Timeline {
  const oldest = releases.at(-1)?.date ?? "";
  const starts = monthStarts(oldest, releases[0]?.date ?? oldest);
  const start = dayNumber(starts[0] ?? oldest);
  const span = dayNumber(starts.at(-1) ?? oldest) - start || 1;
  const x = (day: number) => ((day - start) / span) * 100;
  const ticks = starts.slice(0, -1).flatMap((first) => {
    const day = dayNumber(first);
    return [0, 7, 14, 21].map((offset) => ({
      label: offset === 0 ? shortMonth(first) : undefined,
      x: x(day + offset),
    }));
  });
  const ordered = [...releases].reverse();
  const days = ordered.map((release) => dayNumber(release.date));
  const narrow = lanesFor(days, LANE_GAP.narrow);
  const wide = lanesFor(days, LANE_GAP.wide);
  return {
    keyframes: ordered.map((release, at) => ({
      lanes: { narrow: narrow[at] ?? 0, wide: wide[at] ?? 0 },
      release,
      x: x(days[at] ?? start),
    })),
    lanes: {
      narrow: Math.max(1, ...narrow.map((lane) => lane + 1)),
      wide: Math.max(1, ...wide.map((lane) => lane + 1)),
    },
    ticks,
  };
}

/** A position along the track, as a CSS length. */
export function at(x: number): string {
  return `${x.toFixed(3)}%`;
}
