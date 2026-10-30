/** The comparison band: its modes, Scroll together and Refresh. */

import {
  SegmentedControl,
  type Segment,
} from "../segmented-control/segmented-control.js";

/** A comparison presentation: Current, or one of the three diff modes. */
export type ComparisonMode = "current" | "side" | "overlay" | "difference";

const modes: readonly Segment<ComparisonMode>[] = [
  ["current", "Current"],
  ["side", "Side by side"],
  ["overlay", "Overlay"],
  ["difference", "Difference"],
];

/** Refresh, or its picture in a band that is not interactive. */
function Refresh({
  hidden,
  interactive,
  onRefresh,
}: {
  hidden: boolean;
  interactive: boolean;
  onRefresh: () => void;
}) {
  if (!interactive)
    return (
      <span
        aria-label="Refresh comparison"
        className="mbk-diff-refresh"
        data-diff-refresh=""
        hidden={hidden}
        role="img"
        title="Refresh comparison"
      >
        <span aria-hidden="true">↻</span>
      </span>
    );
  return (
    <button
      aria-label="Refresh comparison"
      className="mbk-diff-refresh"
      data-diff-refresh=""
      hidden={hidden}
      onClick={onRefresh}
      title="Refresh comparison"
      type="button"
    >
      <span aria-hidden="true">↻</span>
    </button>
  );
}

/**
 * The mode group, then the Scroll together switch in every diff mode,
 * including while a comparison loads or has failed, then Refresh once a
 * comparison loaded. The switch is a native checkbox with switch semantics
 * laid over a drawn track, so its label is its hit area and accessible name.
 * It stays native in every band, because it acts in place.
 */
export function ComparisonToolbar({
  current,
  eligible,
  interactive = true,
  loaded,
  mode,
  modeHref,
  onMode,
  onRefresh,
  onTogether,
  together,
}: {
  /** Whether Current is shown, which hides Scroll together and Refresh. */
  current: boolean;
  /** Whether the entry has a comparison; the band is hidden otherwise. */
  eligible: boolean;
  /**
   * Whether a mode without an address and Refresh are buttons, as they are by
   * default. A static depiction that runs no script sets `false`, which draws
   * such a mode as inert text and Refresh as a picture of itself.
   */
  interactive?: boolean;
  /** Whether a comparison loaded, which shows Refresh. */
  loaded: boolean;
  mode: ComparisonMode;
  /**
   * The address that opens a mode, such as another document that shows it. A
   * mode with an address is a link; the others follow `interactive`.
   */
  modeHref?: (mode: ComparisonMode) => string | undefined;
  onMode: (mode: ComparisonMode) => void;
  onRefresh: () => void;
  onTogether: (on: boolean) => void;
  together: boolean;
}) {
  return (
    <div className="mbk-diff-toolbar" hidden={!eligible}>
      <SegmentedControl
        attribute="data-diff-mode"
        href={modeHref}
        interactive={interactive}
        label="Comparison mode"
        onChange={onMode}
        segments={modes}
        value={mode}
      />
      <label className="mbk-diff-sync" hidden={current}>
        <input
          checked={together}
          data-diff-scroll-together=""
          onChange={(event) => onTogether(event.currentTarget.checked)}
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true" className="mbk-diff-sync-track" />
        Scroll together
      </label>
      <Refresh
        hidden={current || !loaded}
        interactive={interactive}
        onRefresh={onRefresh}
      />
    </div>
  );
}
