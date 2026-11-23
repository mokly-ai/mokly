/**
 * The pill above the dock of the compact layout, which names the selected
 * instance: its component, its first prop and its left padding, with a
 * chevron. A press opens the panel's sheet. The pill shows below the layout
 * breakpoint only, and the host leaves it out while a sheet is open.
 */

import { CanvasIcon } from "../icons/canvas-icons.js";

/** One named value of the pill, such as a prop and its value as code. */
function Pair({ name, value }: { name: string; value: string | number }) {
  return (
    <span className="mbk-selection-pill-pair mbk-reset">
      <span className="mbk-selection-pill-key mbk-reset">{name}</span> {value}
    </span>
  );
}

export function SelectionPill({
  component,
  onOpen,
  padding,
  prop,
}: {
  /** The title of the selected instance's component. */
  component: string;
  /** Receives each press, which opens the panel's sheet. */
  onOpen(): void;
  /** The instance's left padding in whole CSS pixels, when it has a box model. */
  padding?: number | undefined;
  /** The instance's first supplied prop, with its value as code. */
  prop?: { name: string; value: string } | undefined;
}) {
  // The spaces keep the parts apart in the pill's name; the flex layout
  // spaces them on screen.
  return (
    <button
      className="mbk-selection-pill mbk-reset"
      data-selection-pill=""
      onClick={onOpen}
      type="button"
    >
      <span className="mbk-selection-pill-name mbk-reset">
        <CanvasIcon name="component" size={12} />
        {component}
      </span>{" "}
      <span className="mbk-selection-pill-props mbk-reset">
        {prop === undefined ? null : (
          <>
            <Pair name={prop.name} value={prop.value} />{" "}
          </>
        )}
        {padding === undefined ? null : <Pair name="padding" value={padding} />}
      </span>
      <CanvasIcon name="chevron" size={14} />
    </button>
  );
}
