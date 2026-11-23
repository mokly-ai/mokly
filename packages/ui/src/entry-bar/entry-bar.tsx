/**
 * The entry bar of the compact layout, over the top of the canvas. It names
 * the selected entry with its title in a dark tag, a `Component` kind tag for
 * a component, its change status, and a quiet label, such as `Showing
 * previous version`, and it holds the frame picker at its end: a native select named `Frame` that lists the entry's shown frames,
 * led by the glyph of the picked frame's kind. The bar shows below the
 * layout breakpoint only, where the section's head, which names the entry
 * on a wide canvas, is absent.
 */

import type { ReactNode } from "react";

import type { CanvasFrameKind } from "../canvas-frame/canvas-frame.js";
import { CanvasIcon } from "../icons/canvas-icons.js";

/** One frame that the picker lists. */
export interface EntryBarFrame {
  /** The kind of the frame, whose glyph leads the picker while it is picked. */
  kind: CanvasFrameKind;
  /** The frame's name, such as `Mobile · Light` or `Disabled · Dark`. */
  label: string;
  /** Names the frame among the picker's frames. */
  value: string;
}

/** The frame picker: the shown frames, the picked one, and the choice. */
export interface EntryBarPicker {
  frames: readonly EntryBarFrame[];
  /** Receives the value of the frame that the reader picks. */
  onChange(value: string): void;
  /** The value of the picked frame. */
  value: string;
}

/** The native select of the frames, over a drawn pill. */
function FramePicker({ frames, onChange, value }: EntryBarPicker) {
  const picked = frames.find((frame) => frame.value === value);
  return (
    <label className="mbk-frame-pick mbk-reset">
      {picked === undefined ? null : (
        <span className="mbk-frame-pick-kind mbk-reset">
          <CanvasIcon name={picked.kind} size={13} />
        </span>
      )}
      <select
        aria-label="Frame"
        className="mbk-reset"
        data-frame-picker=""
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {frames.map((frame) => (
          <option className="mbk-reset" key={frame.value} value={frame.value}>
            {frame.label}
          </option>
        ))}
      </select>
      <span className="mbk-frame-pick-chevron mbk-reset">
        <CanvasIcon name="chevron" size={14} />
      </span>
    </label>
  );
}

export function EntryBar({
  component = false,
  picker,
  quietLabel,
  status,
  title,
}: {
  /** Whether the entry is a component, which adds the `Component` tag. */
  component?: boolean;
  /** The frame picker; without it, as for a reading frame, the bar has none. */
  picker?: EntryBarPicker | undefined;
  /**
   * A quiet label after the status, which says what the canvas shows, such
   * as `Showing previous version` for a removed entry.
   */
  quietLabel?: string | undefined;
  /** The entry's change status, such as a `ChangeStatus`. */
  status?: ReactNode;
  /** The entry's title. */
  title: string;
}) {
  return (
    <div className="mbk-entry-bar mbk-reset" data-entry-bar="">
      <span className="mbk-entry-bar-title mbk-reset">
        <span className="mbk-canvas-title-tag mbk-reset">{title}</span>
        {component ? (
          <span className="mbk-canvas-kind-tag mbk-reset">
            <CanvasIcon name="component" size={13} />
            <span className="mbk-entry-bar-kind mbk-reset">Component</span>
          </span>
        ) : null}
        {status}
        {quietLabel ? (
          <span className="mbk-canvas-quiet-label mbk-entry-bar-quiet mbk-reset">
            {quietLabel}
          </span>
        ) : null}
      </span>
      {picker === undefined ? null : <FramePicker {...picker} />}
    </div>
  );
}
