import type { ArtboardViewport } from "../../../parts/shell.js";
import {
  actionFields,
  type ActionValues,
} from "../../parts/component_props.js";
import { CANVAS_PAGES } from "../../parts/destinations.js";
import { useChosenFrame } from "../../parts/picked_frames.js";

import type { PropsDestination } from "./destinations.js";
import { DefaultEditForm, type EditState } from "./forms.js";
import { ChosenVariantInspect } from "./inspect.js";
import { defaultFrames, pendingOverlays } from "./sketches.js";
import { ChosenVariantArtboard } from "./stage.js";
import { DEFAULT_SAVED } from "./values.js";

/** A depicted state of an edit of Default, the Action's chosen variant. */
export interface DefaultState {
  design: PropsDestination;
  /** The state of the edit form. */
  form: EditState;
  /** The values in the fields. */
  values: ActionValues;
  /**
   * The props that Default's frames render: the edits once a render
   * succeeds, and else the last valid props.
   */
  preview: ActionValues;
  /** A render of the edits is in flight. */
  pending?: boolean | undefined;
}

/** The fields that Props counts while it edits Default. */
const FIELDS = actionFields(DEFAULT_SAVED).length;

/**
 * The Action's variant set with Default chosen, in one state of an edit:
 * Default's frames render the state's preview, a render in flight draws its
 * status over them, and Inspect opens at Props with the state's form.
 * Choosing Disabled opens the variant set with Disabled chosen, its saved
 * props in place of the edits; while editing starts, no artboard shows
 * Disabled, so it is a picture.
 */
export function DefaultStateArtboard({
  state,
  viewport,
}: {
  state: DefaultState;
  viewport: ArtboardViewport;
}) {
  const frames = defaultFrames(state.preview, state.pending);
  const frame = useChosenFrame(frames, "default", viewport);
  const starting =
    state.form === "preparing" || state.form === "preparing-failed";
  return (
    <ChosenVariantArtboard
      design={state.design}
      frame={frame}
      frames={frames}
      overlays={state.pending ? pendingOverlays() : undefined}
      panel={
        <ChosenVariantInspect
          chosen="default"
          frame={frame}
          props={{
            count: FIELDS,
            body: <DefaultEditForm state={state.form} values={state.values} />,
          }}
          variants={{
            default: state.design,
            ...(starting
              ? {}
              : { disabled: CANVAS_PAGES.componentSetDisabled }),
          }}
        />
      }
      viewport={viewport}
    />
  );
}
