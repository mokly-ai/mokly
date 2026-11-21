/**
 * The release timeline: a keyframe track like the timeline of a motion tool.
 * The ruler spans the months of the depicted releases, with a tick for each
 * month and week; each release is a keyframe at its date, filled for a
 * release, hollow for a patch and amber for breaking changes, and the
 * release in view is green under the playhead. A keyframe that would touch
 * another takes a lower lane, at most three. The timeline is a depiction:
 * Version history carries the same links.
 */

import {
  dayNumber,
  isBreaking,
  isPatch,
  shortMonth,
} from "./changelog-facts.js";
import { classNames } from "./class-names.js";
import { SiteIcon } from "./icons.js";
import type { Release } from "./release.js";

/** The most lanes the keyframes take. */
const LANES = 3;

/** The height of a lane and the centre of the first, in pixels. */
const LANE_HEIGHT = 18;
const FIRST_LANE = 16;

/**
 * How many days two keyframes need between them to share a lane: the
 * desktop track gives a day about 11px, the mobile track about 3.6px, and a
 * keyframe is about 16px wide.
 */
const LANE_GAP = { desktop: 2, mobile: 5 } as const;

/** A tick of the ruler, with the month's name when it starts a month. */
interface Tick {
  label: string | undefined;
  x: number;
}

/** A keyframe on its lane. */
interface Keyframe {
  lane: number;
  release: Release;
  x: number;
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

/** The ruler, the keyframes and the lane count of the depicted releases. */
function timeline(releases: readonly Release[], gap: number) {
  const oldest = releases.at(-1)?.date ?? "";
  const starts = monthStarts(oldest, releases[0]?.date ?? oldest);
  const start = dayNumber(starts[0] ?? oldest);
  const span = dayNumber(starts.at(-1) ?? oldest) - start || 1;
  const x = (day: number) => ((day - start) / span) * 100;
  const ticks: Tick[] = starts.slice(0, -1).flatMap((first) => {
    const day = dayNumber(first);
    return [0, 7, 14, 21].map((offset) => ({
      label: offset === 0 ? shortMonth(first) : undefined,
      x: x(day + offset),
    }));
  });
  const ends: number[] = [];
  const keyframes: Keyframe[] = [...releases].reverse().map((release) => {
    const day = dayNumber(release.date);
    let lane = ends.findIndex((end) => day - end >= gap);
    if (lane < 0 && ends.length < LANES) lane = ends.length;
    if (lane < 0) lane = ends.indexOf(Math.min(...ends));
    ends[lane] = day;
    return { lane, release, x: x(day) };
  });
  return { keyframes, lanes: ends.length, ticks };
}

/** A position along the track, as a CSS length. */
function at(x: number): string {
  return `${x.toFixed(3)}%`;
}

/** The class of a keyframe: its kind, and whether it is the one in view. */
function keyClass(release: Release, current: boolean): string {
  return classNames(
    "site-changelog-key",
    isPatch(release) && "site-changelog-key--patch",
    isBreaking(release) && "site-changelog-key--breaking",
    current && "site-changelog-key--current",
  );
}

/** The timeline frame. `current` names the version of the release in view. */
export function ChangelogTimeline({
  current,
  releases,
  viewport,
}: {
  current: string | undefined;
  releases: readonly Release[];
  viewport: "mobile" | "desktop";
}) {
  const { keyframes, lanes, ticks } = timeline(releases, LANE_GAP[viewport]);
  const first = keyframes[0]?.x ?? 0;
  const last = keyframes.at(-1)?.x ?? 0;
  const playhead = keyframes.find((key) => key.release.version === current);
  return (
    <div aria-hidden="true" className="site-changelog-timeline">
      <div className="site-changelog-timeline-head">
        <span className="site-changelog-timeline-title">
          <SiteIcon name="history" size={14} />
          Timeline
        </span>
        <span className="site-changelog-timeline-legend">
          <span className="site-changelog-key" />
          Release
          <span className="site-changelog-key site-changelog-key--patch" />
          Patch
          <span className="site-changelog-key site-changelog-key--breaking" />
          Breaking
        </span>
      </div>
      <div className="site-changelog-timeline-area">
        <div className="site-changelog-ruler">
          {ticks.map((tick) => (
            <span
              className={classNames(
                "site-changelog-tick",
                tick.label !== undefined && "site-changelog-tick--month",
              )}
              key={tick.x}
              style={{ left: at(tick.x) }}
            >
              {tick.label === undefined ? null : <b>{tick.label}</b>}
            </span>
          ))}
        </div>
        <div
          className="site-changelog-keys"
          style={{ height: `${lanes * LANE_HEIGHT + 14}px` }}
        >
          <span
            className="site-changelog-bar"
            style={{ left: at(first), width: at(last - first) }}
          />
          {keyframes.map((key) => (
            <span
              className={keyClass(key.release, key === playhead)}
              key={key.release.version}
              style={{
                left: at(key.x),
                top: `${FIRST_LANE + key.lane * LANE_HEIGHT}px`,
              }}
            />
          ))}
        </div>
        {playhead === undefined ? null : (
          <span
            className="site-changelog-playhead"
            style={{ left: at(playhead.x) }}
          >
            <b>v{playhead.release.version}</b>
          </span>
        )}
      </div>
    </div>
  );
}
