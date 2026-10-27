/** The comparison band: its modes, Scroll together and Refresh. */

/** A comparison presentation: Current, or one of the three diff modes. */
export type ComparisonMode = "current" | "side" | "overlay" | "difference";

const modes: readonly [ComparisonMode, string][] = [
  ["current", "Current"],
  ["side", "Side by side"],
  ["overlay", "Overlay"],
  ["difference", "Difference"],
];

/**
 * The mode group, then the Scroll together switch in every diff mode,
 * including while a comparison loads or has failed, then Refresh once a
 * comparison loaded. The switch is a native checkbox with switch semantics
 * laid over a drawn track, so its label is its hit area and accessible name.
 */
export function ComparisonToolbar({
  current,
  eligible,
  loaded,
  mode,
  onMode,
  onRefresh,
  onTogether,
  together,
}: {
  /** Whether Current is shown, which hides Scroll together and Refresh. */
  current: boolean;
  /** Whether the entry has a comparison; the band is hidden otherwise. */
  eligible: boolean;
  /** Whether a comparison loaded, which shows Refresh. */
  loaded: boolean;
  mode: ComparisonMode;
  onMode: (mode: ComparisonMode) => void;
  onRefresh: () => void;
  onTogether: (on: boolean) => void;
  together: boolean;
}) {
  return (
    <div className="mbk-diff-toolbar" hidden={!eligible}>
      <span aria-label="Comparison mode" className="mbk-seg" role="group">
        {modes.map(([value, label]) => (
          <button
            aria-pressed={mode === value}
            data-diff-mode={value}
            key={value}
            onClick={() => onMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </span>
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
      <button
        aria-label="Refresh comparison"
        className="mbk-diff-refresh"
        data-diff-refresh=""
        hidden={current || !loaded}
        onClick={onRefresh}
        title="Refresh comparison"
        type="button"
      >
        <span aria-hidden="true">↻</span>
      </button>
    </div>
  );
}
