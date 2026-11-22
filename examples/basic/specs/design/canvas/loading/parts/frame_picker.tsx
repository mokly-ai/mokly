import { CanvasGlyph } from "../../../library/canvas/glyphs.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";

/** A viewport glyph of the picker, which the picked frame's viewport shows. */
function PickerGlyph({ glyph }: { glyph: "desktop" | "mobile" }) {
  return (
    <span aria-hidden="true" className="cv-frame-pick-glyph" data-glyph={glyph}>
      <CanvasGlyph name={glyph} size={13} />
    </span>
  );
}

/**
 * The frame picker of a screen's compact entry bar: a native select of the
 * screen's frames over a drawn pill, which opens on Mobile · Light and shows
 * the picked frame's viewport glyph. The catalogue index names the entry's
 * views, so the picker lists them before the entry's detail arrives. It
 * draws the picker that `../../parts/stage.tsx` keeps inside the stage, for
 * a stage that holds no section.
 */
export function ScreenFramePicker({
  frames,
}: {
  frames: readonly CanvasFrameSpec[];
}) {
  return (
    <label className="cv-frame-pick">
      <PickerGlyph glyph="mobile" />
      <PickerGlyph glyph="desktop" />
      <select
        aria-label="Frame"
        data-cv-frame-pick=""
        defaultValue="mobile-light"
      >
        {frames.map((frame) => (
          <option key={frame.id} value={frame.id}>
            {frame.label}
          </option>
        ))}
      </select>
      <CanvasGlyph name="chevron" size={14} />
    </label>
  );
}
