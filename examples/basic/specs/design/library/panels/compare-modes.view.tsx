import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { CanvasGlyph } from "../canvas/glyphs.js";

import type { CompareModesProps } from "./compare-modes.js";
import { CompareIcon } from "./compare_icons.js";

type CompareMode = CompareModesProps["mode"];
type CompareFrame = NonNullable<CompareModesProps["frame"]>;

/** The compare modes in the order of their keys, 1 to 5, with their names. */
const MODES: readonly (readonly [CompareMode, string])[] = [
  ["current", "Current"],
  ["side-by-side", "Side by side"],
  ["overlay", "Overlay"],
  ["difference", "Difference"],
  ["swipe", "Swipe"],
];

/** The frames that Side by side can compare, as the canvas labels them. */
const FRAMES: readonly (readonly [
  CompareFrame,
  "desktop" | "mobile",
  string,
])[] = [
  ["desktop-light", "desktop", "Desktop · Light"],
  ["mobile-light", "mobile", "Mobile · Light"],
  ["desktop-dark", "desktop", "Desktop · Dark"],
  ["mobile-dark", "mobile", "Mobile · Dark"],
];

/**
 * One mode's tile: its icon, its name, and its key. The shown mode's tile
 * names the current page. A tile links to the artboard that shows its mode,
 * and a tile without one is a picture of itself. The tile is named by its
 * mode, and its key is its shortcut.
 */
function ModeTile({
  index,
  label,
  mode,
  shown,
  to,
}: {
  index: number;
  label: string;
  mode: CompareMode;
  shown: boolean;
  to: DesignDestination | undefined;
}) {
  const current = useCurrentPage();
  const body = (
    <>
      <CompareIcon mode={mode} />
      <span className="cv-mode-name">{label}</span>
      <kbd aria-hidden="true" className="cv-mode-key">
        {index + 1}
      </kbd>
    </>
  );
  return to === undefined ? (
    <span
      aria-current={shown ? "true" : undefined}
      className="cv-mode"
      data-mode={mode}
    >
      {body}
    </span>
  ) : (
    <a
      aria-current={current(to) ?? (shown ? "true" : undefined)}
      aria-keyshortcuts={String(index + 1)}
      aria-label={label}
      className="cv-mode"
      data-mode={mode}
      href={mockLink(to)}
    >
      {body}
    </a>
  );
}

/**
 * The frames that Side by side can compare, as chips. The compared frame's
 * chip links to the artboard that shows it, and every other chip is a
 * picture of itself.
 */
function FrameChips({
  frame,
  to,
}: {
  frame: CompareFrame;
  to: DesignDestination | undefined;
}) {
  const current = useCurrentPage();
  return (
    <ul aria-label="Compared frame" className="cv-mode-frames">
      {FRAMES.map(([id, glyph, label]) => {
        const chosen = id === frame;
        const content = (
          <>
            <CanvasGlyph name={glyph} size={12} />
            {label}
          </>
        );
        return (
          <li key={id}>
            {chosen && to !== undefined ? (
              <a
                aria-current={current(to) ?? "true"}
                className="cv-mode-frame"
                href={mockLink(to)}
              >
                {content}
              </a>
            ) : (
              <span
                aria-current={chosen ? "true" : undefined}
                className="cv-mode-frame"
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The compare modes of Changes: a tile for each mode, of which an entry
 * that the branch added has Current alone; the compared frame's chips in
 * Side by side; and, in a comparison, the Scroll together switch and
 * Refresh, as the comparison band draws them. A static artboard runs no
 * script, so the switch is a native control, and Refresh is a picture of
 * itself.
 */
export function CompareModesView({
  comparable,
  destinations,
  frame,
  frameDestination,
  mode,
  scrollTogether,
}: CompareModesProps) {
  const shown = comparable ? MODES : MODES.slice(0, 1);
  return (
    <div className="cv-modes">
      <ul aria-label="Comparison mode" className="cv-mode-tiles">
        {shown.map(([id, label], index) => (
          <li key={id}>
            <ModeTile
              index={index}
              label={label}
              mode={id}
              shown={id === mode}
              to={destinations[id]}
            />
          </li>
        ))}
      </ul>
      {mode === "side-by-side" && frame !== undefined ? (
        <FrameChips frame={frame} to={frameDestination} />
      ) : null}
      {mode === "current" ? null : (
        <div className="cv-mode-sync">
          <label className="cv-mode-switch">
            <span className="cv-mode-switch-name">Scroll together</span>
            <input
              data-cv-scroll-together=""
              defaultChecked={scrollTogether}
              role="switch"
              type="checkbox"
            />
            <span aria-hidden="true" className="cv-mode-switch-track" />
          </label>
          <span
            aria-label="Refresh comparison"
            className="cv-mode-refresh"
            role="img"
            title="Refresh comparison"
          >
            <CanvasGlyph name="refresh" size={15} />
          </span>
        </div>
      )}
    </div>
  );
}
