import type { ReactNode } from "react";

import { EditStatus } from "../../../../../../../packages/ui/src/edit-status/edit-status.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import { DesignInstances } from "../../../library/composition.js";
import type { ActionValues } from "../../parts/component_props.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { actionFrames } from "../../parts/set_sketches.js";

/**
 * The Action's component document with the given props, as its definition
 * renders them: the button 24px from the top left in its emphasis, drawn
 * disabled where the props say so, with the corner radius that the props set
 * as the button's own style, and the hint below it where the props set one.
 * It reads the preview tokens, so a dark frame draws it on the dark screen.
 * While a render of edits is in flight, the document is busy; the status
 * over the frame stays outside it, so it is announced.
 */
function ActionSketch({
  busy,
  values,
}: {
  busy: boolean;
  values: ActionValues;
}) {
  const look = values.disabled ? "disabled" : values.tone;
  return (
    <div
      aria-busy={busy ? "true" : undefined}
      className="mbk-shot mbk-shot--action"
    >
      <div className="mbk-shot-pad">
        <span
          className={`mbk-shot-action mbk-shot-action--${look}`}
          style={
            values.radius === undefined
              ? undefined
              : { borderRadius: values.radius }
          }
        >
          {values.label}
        </span>
        {values.hint === undefined ? null : <p>{values.hint}</p>}
      </div>
    </div>
  );
}

/**
 * The Action's variant set with Default's two frames rendering the given
 * props: an edit renders in each view of the variant that Props edits, so
 * Light and Dark both show it, while Disabled and Secondary keep their saved
 * props. While a render is pending, the frames keep the last valid props.
 */
export function defaultFrames(
  values: ActionValues,
  busy = false,
): CanvasFrameSpec[] {
  return actionFrames().map((frame) =>
    frame.variant === "default"
      ? {
          ...frame,
          content: (
            <DesignInstances name={frame.id}>
              <ActionSketch busy={busy} values={values} />
            </DesignInstances>
          ),
        }
      : frame,
  );
}

/**
 * What lies over each frame of Default while a render of the edits is in
 * flight: the shipped status of the render, which the Canvas sheet draws as
 * a pill at the frame's top.
 */
export function pendingOverlays(): Readonly<Record<string, ReactNode>> {
  const status = <EditStatus status={CONTROLS_COPY.updating} />;
  return { "default-light": status, "default-dark": status };
}
