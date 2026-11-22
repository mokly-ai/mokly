import type { ReactNode } from "react";

import { optional } from "../../../library/composition.js";
import {
  PendingUsage,
  type PendingDetails,
} from "../../loading/parts/details.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { InspectFold, InspectFrames } from "../../parts/inspect.js";
import { ActionUsage } from "../../parts/inspect_folds.js";
import { InspectFrameSelected } from "../../parts/inspect_selection.js";
import { ComponentHead, SET_FILTER } from "../../parts/inspect_sets.js";
import { InspectVariants } from "../../parts/inspect_variants.js";

/** A saved variant of the Action that the Props states choose. */
export type ChosenVariant = "default" | "disabled";

/** The title of each chosen variant, as its frames and Props name it. */
export const VARIANT_TITLES: Record<ChosenVariant, string> = {
  default: "Default",
  disabled: "Disabled",
};

/** The Props section of a state: its body, with its count where known. */
interface PropsSection {
  count?: number | undefined;
  body: ReactNode;
}

/**
 * Inspect for the Action with a saved variant chosen: its head, its saved
 * variants with the chosen one checked, its frames, the selected frame, the
 * Props section unfolded with the body of the depicted state, which the
 * panel opens scrolled to, and Usage. The Action renders no registered
 * component, so Highlight components is unavailable. Until the route's
 * details arrive, no frame mounts, so Highlight components waits for the
 * component preview, also after a failed load, and Usage has no count.
 * After a failed load, Usage says so, with Try again.
 */
export function ChosenVariantInspect({
  chosen,
  details,
  frame,
  props,
  variants,
}: {
  chosen: ChosenVariant;
  /** The route's details while they load or failed; they arrived by default. */
  details?: PendingDetails | undefined;
  /** The chosen variant's Light frame, which the reader selected. */
  frame: CanvasFrameSpec;
  props: PropsSection;
  /** The artboard that shows each variant chosen, from this state. */
  variants: Partial<Record<ChosenVariant, CanvasDestination>>;
}) {
  const variant = (slug: ChosenVariant) => ({
    label: VARIANT_TITLES[slug],
    ...(slug === chosen ? { current: true } : {}),
    ...optional("to", variants[slug]),
  });
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.action}
        entry={CANVAS_ENTRIES.action}
      />
      <InspectVariants
        variants={[
          variant("default"),
          variant("disabled"),
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={6}
        filter={{
          ...SET_FILTER,
          unavailable: details === undefined ? "empty" : "loading",
        }}
      />
      <InspectFrameSelected frame={frame} variant={VARIANT_TITLES[chosen]} />
      <InspectFold count={props.count} initial name="props" open title="Props">
        {props.body}
      </InspectFold>
      <InspectFold
        count={details === undefined ? 3 : undefined}
        name="usage"
        title="Usage"
      >
        {details === undefined ? (
          <ActionUsage />
        ) : (
          <PendingUsage details={details} />
        )}
      </InspectFold>
    </>
  );
}
