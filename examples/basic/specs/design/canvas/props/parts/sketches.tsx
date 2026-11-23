import type { ReactNode } from "react";

import { EditStatus } from "../../../../../../../packages/ui/src/edit-status/edit-status.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import { DesignInstances } from "../../../library/composition.js";
import { MiniActionDocument } from "../../../parts/mini_action.js";
import type { ActionValues } from "../../parts/component_props.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import {
  COMPONENT_DOCUMENTS,
  actionSetFrames,
} from "../../parts/set_sketches.js";

/**
 * The size of Default's document with the given props: its measured size
 * with its hint, and the own example's without one, whose button the label
 * edits leave narrower than the hint.
 */
function defaultSize(values: ActionValues) {
  return values.hint === undefined
    ? COMPONENT_DOCUMENTS.action
    : COMPONENT_DOCUMENTS.actionDefault;
}

/**
 * The Action's variant set with Default's two frames rendering the given
 * props, as its definition renders them: the button in its emphasis, drawn
 * disabled where the props say so, with the corner radius that the props set
 * as the button's own style, and the hint below it where the props set one.
 * An edit renders in each view of the variant that Props edits, so Light and
 * Dark both show it, at the size of the document that it renders, while the
 * own example, Disabled, and Secondary keep their saved props. While a
 * render is pending, the frames keep the last valid props, and the document
 * is busy.
 */
export function defaultFrames(
  values: ActionValues,
  busy = false,
): CanvasFrameSpec[] {
  return actionSetFrames().map((frame) =>
    frame.variant === "default"
      ? {
          ...frame,
          ...defaultSize(values),
          content: (
            <DesignInstances name={frame.id}>
              <MiniActionDocument
                busy={busy}
                hint={values.hint}
                label={values.label}
                look={values.disabled ? "disabled" : values.tone}
                radius={values.radius}
              />
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
