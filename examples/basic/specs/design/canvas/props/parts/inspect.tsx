import type { ReactNode } from "react";

import { UsageStatus } from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import { optional } from "../../../library/composition.js";
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
 * details arrive, the frames have no usage yet and Usage has no count.
 */
export function ChosenVariantInspect({
  chosen,
  frame,
  loading = false,
  props,
  variants,
}: {
  chosen: ChosenVariant;
  /** The chosen variant's Light frame, which the reader selected. */
  frame: CanvasFrameSpec;
  /** The route's details are loading. */
  loading?: boolean | undefined;
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
        filter={{ ...SET_FILTER, unavailable: loading ? "loading" : "empty" }}
      />
      <InspectFrameSelected frame={frame} variant={VARIANT_TITLES[chosen]} />
      <InspectFold count={props.count} initial name="props" open title="Props">
        {props.body}
      </InspectFold>
      <InspectFold count={loading ? undefined : 3} name="usage" title="Usage">
        {loading ? <UsageStatus status="loading" /> : <ActionUsage />}
      </InspectFold>
    </>
  );
}
