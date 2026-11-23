/**
 * The compare modes of the Changes tab: a tile for each offered mode in the
 * order of their keys, Current across the row above the four comparisons;
 * in Side by side, the chips of the frames that it can compare; and in every
 * mode other than Current, the Scroll together switch and, once a comparison
 * loaded, Refresh. The host holds the mode, the compared frame, and the
 * switch, and binds the keys.
 */

import { RefreshGlyph } from "./compare-icons.js";
import { FrameChips } from "./frame-chips.js";
import { ModeTile } from "./mode-tile.js";

/** A comparison presentation: Current, or one of the four compare modes. */
export type CompareMode =
  "current" | "side" | "overlay" | "difference" | "swipe";

/** Every mode and its name, in the order of their keys: the first is key 1. */
export const COMPARE_MODES: readonly (readonly [
  mode: CompareMode,
  name: string,
])[] = [
  ["current", "Current"],
  ["side", "Side by side"],
  ["overlay", "Overlay"],
  ["difference", "Difference"],
  ["swipe", "Swipe"],
];

/** A frame that Side by side can compare, as its chip names it. */
export interface CompareFrame {
  /** The frame's stable key, which `frame` and `onFrame` use. */
  key: string;
  /** The chip's text, such as `Desktop · Light`. */
  label: string;
  /** The glyph before the text. */
  kind: "desktop" | "mobile" | "component";
}

/** Refresh, or its picture in a static depiction. */
function Refresh({
  interactive,
  onRefresh,
}: {
  interactive: boolean;
  onRefresh: (() => void) | undefined;
}) {
  if (!interactive)
    return (
      <span
        aria-label="Refresh comparison"
        className="mbk-compare-refresh mbk-reset"
        data-diff-refresh=""
        role="img"
        title="Refresh comparison"
      >
        <RefreshGlyph />
      </span>
    );
  return (
    <button
      aria-label="Refresh comparison"
      className="mbk-compare-refresh mbk-reset"
      data-diff-refresh=""
      onClick={onRefresh}
      title="Refresh comparison"
      type="button"
    >
      <RefreshGlyph />
    </button>
  );
}

/**
 * The key of each mode is its place in `COMPARE_MODES`, so Current keeps key 1
 * when it is the only tile. The switch is a native checkbox with switch
 * semantics laid over a drawn track, so its label is its hit area and its
 * name. It stays native in every form, because it acts in place.
 */
export function CompareModes({
  comparable,
  frame,
  frameHref,
  frames = [],
  interactive = true,
  loaded,
  mode,
  modeHref,
  onFrame,
  onMode,
  onRefresh,
  onTogether,
  together,
}: {
  /** The shown mode. */
  mode: CompareMode;
  /** Whether the entry offers every mode; an added entry offers Current alone. */
  comparable: boolean;
  onMode?: ((mode: CompareMode) => void) | undefined;
  /** The address that shows a mode; a mode with one is a link. */
  modeHref?: ((mode: CompareMode) => string | undefined) | undefined;
  /** Default true. `false` draws a mode without an address as inert text and Refresh as a picture. */
  interactive?: boolean | undefined;
  /** The frames that Side by side can compare, one chip each. */
  frames?: readonly CompareFrame[] | undefined;
  /** The key of the compared frame. */
  frame?: string | undefined;
  onFrame?: ((key: string) => void) | undefined;
  /** The address that shows a frame's comparison; a chip with one is a link. */
  frameHref?: ((key: string) => string | undefined) | undefined;
  /** Whether Scroll together is on. */
  together: boolean;
  onTogether?: ((on: boolean) => void) | undefined;
  /** Whether a comparison loaded, which shows Refresh. */
  loaded: boolean;
  onRefresh?: (() => void) | undefined;
}) {
  return (
    <div className="mbk-compare-modes mbk-reset">
      <div
        aria-label="Comparison mode"
        className="mbk-compare-tiles mbk-reset"
        role="group"
      >
        {COMPARE_MODES.map(([value, name], index) =>
          comparable || value === "current" ? (
            <ModeTile
              href={modeHref?.(value)}
              interactive={interactive}
              key={value}
              mode={value}
              name={name}
              onMode={onMode}
              shortcut={String(index + 1)}
              shown={value === mode}
            />
          ) : null,
        )}
      </div>
      {mode === "side" && frames.length > 0 ? (
        <FrameChips
          frame={frame}
          frameHref={frameHref}
          frames={frames}
          interactive={interactive}
          onFrame={onFrame}
        />
      ) : null}
      {mode === "current" ? null : (
        <div className="mbk-compare-sync mbk-reset">
          <label className="mbk-compare-switch mbk-reset">
            <span className="mbk-compare-switch-name mbk-reset">
              Scroll together
            </span>
            <input
              checked={together}
              className="mbk-reset"
              data-diff-scroll-together=""
              onChange={(event) => onTogether?.(event.currentTarget.checked)}
              role="switch"
              type="checkbox"
            />
            <span
              aria-hidden="true"
              className="mbk-compare-switch-track mbk-reset"
            />
          </label>
          {loaded ? (
            <Refresh interactive={interactive} onRefresh={onRefresh} />
          ) : null}
        </div>
      )}
    </div>
  );
}
