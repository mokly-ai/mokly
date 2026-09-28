/** Static/Live segmented control in the view toolbar. */

import type { PreviewModeChoice } from "./live_preview.js";
import { LIVE_PREVIEW_COPY } from "./preview_mode.js";

/**
 * Two toggle buttons in the shared segmented style. An unavailable Live stays
 * focusable so its reason can be read, but it does not change the preview.
 */
export function PreviewModeControl({ choice }: { choice: PreviewModeChoice }) {
  const liveTitle = choice.unavailable
    ? LIVE_PREVIEW_COPY.unavailable
    : LIVE_PREVIEW_COPY.liveTitle;
  return (
    <span
      aria-label="Preview mode"
      className="mbk-seg mbk-preview-mode"
      data-preview-mode=""
      role="group"
    >
      <button
        aria-pressed={!choice.live}
        data-preview-mode-option="static"
        onClick={() => choice.select("static")}
        title={LIVE_PREVIEW_COPY.staticTitle}
        type="button"
      >
        Static
      </button>
      <button
        aria-description={
          choice.unavailable ? LIVE_PREVIEW_COPY.unavailable : undefined
        }
        aria-disabled={choice.unavailable ? true : undefined}
        aria-pressed={choice.live}
        data-preview-mode-option="live"
        onClick={() => {
          if (!choice.unavailable) choice.select("live");
        }}
        title={liveTitle}
        type="button"
      >
        Live
      </button>
    </span>
  );
}
