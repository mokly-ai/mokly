/**
 * The Frames filter of Inspect: a toggle for each viewport and each scheme
 * that the canvas can show, and the Highlight components switch. Each toggle
 * is a native checkbox under its drawn tile, or, where the filter chooses one
 * viewport and one scheme, as a use case's does, a native radio button of
 * its axis. A disabled toggle names why in its note, such as `Light only`.
 * A toggle behind which a changed view hides carries the change mark and
 * names its wording through `aria-describedby`. The host holds the state and
 * receives each change.
 */

import { useId, type Ref } from "react";

import { ChangeMark } from "../change-mark/change-mark.js";
import { CanvasIcon } from "../icons/canvas-icons.js";

/** A toggle of the filter: one viewport or one scheme. */
export type FramesToggleName = "dark" | "desktop" | "light" | "mobile";

/** The axis, the glyph and the name of each toggle. */
const TOGGLES = {
  mobile: { axis: "viewport", label: "Mobile" },
  desktop: { axis: "viewport", label: "Desktop" },
  light: { axis: "scheme", label: "Light" },
  dark: { axis: "scheme", label: "Dark" },
} as const satisfies Record<
  FramesToggleName,
  { axis: "scheme" | "viewport"; label: string }
>;

/** One toggle's state. */
export interface FramesToggle {
  checked: boolean;
  /** Whether the toggle cannot change, such as Dark on a light-only screen. */
  disabled?: boolean | undefined;
  /** The change mark of a toggle that hides a changed view. */
  mark?: { id: string; marked: boolean; text: string } | undefined;
  name: FramesToggleName;
  /** The line below the name, such as `390 × 844` or `Light only`. */
  note?: string | undefined;
}

/** The state of the Highlight components switch. */
export interface FramesHighlight {
  /** Whether highlighting is on, which checks the switch. */
  active: boolean;
  /** Whether the shown frames can be highlighted. Otherwise the switch is disabled. */
  available: boolean;
  /** Why highlighting is unavailable, which describes and titles the switch. */
  reason?: string | undefined;
}

/** What the switch describes while highlighting is available. */
const HIGHLIGHT_DESCRIPTION =
  "Inspect component regions and their supplied props.";

function Toggle({
  group,
  onToggle,
  single,
  toggle,
}: {
  group: string;
  onToggle(name: FramesToggleName, checked: boolean): void;
  single: boolean;
  toggle: FramesToggle;
}) {
  const { axis, label } = TOGGLES[toggle.name];
  const marked = toggle.mark?.marked === true;
  // The mark stands beside the label, so its wording describes the toggle
  // without joining its name.
  return (
    <span className="mbk-frames-cell mbk-reset">
      <label className="mbk-frames-toggle mbk-reset">
        <input
          aria-describedby={marked ? toggle.mark?.id : undefined}
          checked={toggle.checked}
          className="mbk-reset"
          data-frames-toggle={toggle.name}
          disabled={toggle.disabled}
          name={single ? `${group}-${axis}` : undefined}
          onChange={(event) =>
            onToggle(toggle.name, event.currentTarget.checked)
          }
          type={single ? "radio" : "checkbox"}
        />
        <CanvasIcon name={toggle.name} size={14} />
        <span className="mbk-frames-name mbk-reset">{label}</span>
        {toggle.note === undefined ? null : (
          <small className="mbk-frames-note mbk-reset">{toggle.note}</small>
        )}
      </label>
      {toggle.mark === undefined ? null : (
        <ChangeMark
          id={toggle.mark.id}
          kind={axis}
          marked={marked}
          text={toggle.mark.text}
        />
      )}
    </span>
  );
}

export function FramesFilter({
  descriptionId,
  highlight,
  highlightRef,
  onHighlight,
  onToggle,
  single = false,
  toggles,
}: {
  /**
   * The id of the switch's description, which must be unique in the
   * document. Without it, the filter takes an id from React's `useId`.
   */
  descriptionId?: string | undefined;
  /** The Highlight components switch. Without it, the switch is disabled. */
  highlight?: FramesHighlight | undefined;
  /** Receives the switch, which the host focuses when a pick in a frame ends. */
  highlightRef?: Ref<HTMLInputElement> | undefined;
  /** Receives each change of the switch. */
  onHighlight?: (() => void) | undefined;
  /** Receives each toggle that the reader changes, with its new state. */
  onToggle(name: FramesToggleName, checked: boolean): void;
  /** Whether the filter chooses one viewport and one scheme, with radio buttons. */
  single?: boolean | undefined;
  /** The toggles in their order, such as Mobile, Desktop, Light and Dark. */
  toggles: readonly FramesToggle[];
}) {
  const group = useId();
  const generated = useId();
  const description = descriptionId ?? generated;
  const available = highlight?.available === true;
  const reason = available ? undefined : highlight?.reason;
  return (
    <div aria-label="Frames" className="mbk-frames mbk-reset" role="group">
      <div className="mbk-frames-grid mbk-reset">
        {toggles.map((toggle) => (
          <Toggle
            group={group}
            key={toggle.name}
            onToggle={onToggle}
            single={single}
            toggle={toggle}
          />
        ))}
      </div>
      <label
        className="mbk-frames-switch mbk-reset"
        title={reason ?? "Highlight components"}
      >
        <CanvasIcon name="highlight" size={14} />
        <span className="mbk-frames-switch-name mbk-reset">
          Highlight components
        </span>
        <input
          aria-describedby={description}
          checked={available && highlight?.active === true}
          className="mbk-reset"
          data-workspace-highlight=""
          disabled={!available}
          onChange={() => onHighlight?.()}
          ref={highlightRef}
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true" className="mbk-frames-track mbk-reset" />
      </label>
      <span className="mbk-frames-description mbk-reset" id={description}>
        {reason ?? HIGHLIGHT_DESCRIPTION}
      </span>
    </div>
  );
}
