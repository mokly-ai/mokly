import { FRAME_SIZES } from "../canvas/frame_sizes.js";
import { CanvasGlyph, type CanvasGlyphName } from "../canvas/glyphs.js";

import type { FramesFilterProps } from "./frames-filter.js";

/**
 * The shell's own sentence for each reason that disables Highlight
 * components, word for word, so a depicted switch reads as the shell's does.
 */
export const HIGHLIGHT_REASONS = {
  empty: "No registered components are used in this view.",
  unavailable: "Component inspection is unavailable for this view.",
  loading: "Waiting for the component preview.",
  failed: "This preview could not be loaded.",
  comparison: "A comparison is selected. Highlighting is available in Current.",
  removed: "This preview is unavailable.",
} as const satisfies Record<
  NonNullable<FramesFilterProps["unavailable"]>,
  string
>;

/** One frame toggle: the frames it shows, its glyph, its name, its size. */
interface FrameToggle {
  id: "dark" | "desktop" | "light" | "mobile";
  glyph: CanvasGlyphName;
  label: string;
  size?: string;
}

const size = ({ height, width }: { height: number; width: number }) =>
  `${width} × ${height}`;

const VIEWPORT_TOGGLES: readonly FrameToggle[] = [
  {
    id: "mobile",
    glyph: "mobile",
    label: "Mobile",
    size: size(FRAME_SIZES.mobile),
  },
  {
    id: "desktop",
    glyph: "desktop",
    label: "Desktop",
    size: size(FRAME_SIZES.desktop),
  },
];

const SCHEME_TOGGLES: readonly FrameToggle[] = [
  { id: "light", glyph: "light", label: "Light" },
  { id: "dark", glyph: "dark", label: "Dark" },
];

/**
 * The Frames filter of Inspect: a toggle for each viewport and each scheme,
 * and the Highlight components switch. A static artboard runs no script, so
 * each toggle and the switch are native checkboxes that start in the shown
 * state; the Canvas stylesheet reads them to hide frames and to reveal the
 * shipped highlight in place. The switch starts in the state that the shell
 * shows for the depicted view, and a reason disables it with the shell's own
 * sentence. A component set's frames are its variants in each scheme, so it
 * has no viewport toggles, and a light-only screen's Dark toggle is disabled.
 */
export function FramesFilterView(props: FramesFilterProps) {
  const toggles = props.viewports
    ? [...VIEWPORT_TOGGLES, ...SCHEME_TOGGLES]
    : SCHEME_TOGGLES;
  const reason = props.unavailable
    ? HIGHLIGHT_REASONS[props.unavailable]
    : undefined;
  return (
    <div aria-label="Frames" className="cv-ff-group" role="group">
      <div className="cv-ff-grid">
        {toggles.map((toggle) => {
          // A screen without a dark render has no Dark frames to show.
          const absent = toggle.id === "dark" && props.lightOnly === true;
          const note = absent ? "Light only" : toggle.size;
          return (
            <label className="cv-ff" key={toggle.id}>
              <input
                data-cv-frames={toggle.id}
                defaultChecked={props[toggle.id] && !absent}
                disabled={absent}
                type="checkbox"
              />
              <CanvasGlyph name={toggle.glyph} size={14} />
              <span className="cv-ff-name">{toggle.label}</span>
              {note === undefined ? null : (
                <small className="cv-ff-size">{note}</small>
              )}
            </label>
          );
        })}
      </div>
      <label className="cv-switch" title={reason ?? "Highlight components"}>
        <CanvasGlyph name="highlight" size={14} />
        <span className="cv-switch-name">Highlight components</span>
        <input
          aria-description={reason}
          data-workspace-highlight=""
          defaultChecked={props.highlight && reason === undefined}
          disabled={reason !== undefined}
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true" className="cv-switch-track" />
      </label>
    </div>
  );
}
