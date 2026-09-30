/** Project completed ownership evidence onto the one comparison being displayed. */
import type { ReviewResultV4 } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { aggregateIgnored } from "./screen_views.js";
import type { ReviewSelection } from "./selection_types.js";

export function selectedComponentResult(
  result: ReviewResultV4,
  selection: ReviewSelection,
): ReviewResultV4 {
  const screens = result.screens.filter((screen) => screen.id === selection.id);
  const component = result.components.find((entry) =>
    entry.variants.some((variant) => variant.id === selection.id),
  );
  const variant = component?.variants.find(
    (entry) => entry.id === selection.id,
  );
  if (!screens.length && (!component || !variant)) throw missingSelection();
  const components =
    component && variant
      ? [{ ...component, state: variant.state, variants: [variant] }]
      : [];
  return {
    ...result,
    screens,
    components,
    changes: result.changes.filter((entry) => {
      if (entry.kind !== (components.length ? "component" : "screen"))
        return false;
      const address = entry.after ?? entry.before;
      return address?.id === selection.id;
    }),
    affectedConsumers: [],
    ignoredImpact: aggregateIgnored(screens),
  };
}

export function missingSelection(): MoklyError {
  return new MoklyError(
    "review-invalid",
    "The selected view has no comparison",
  );
}
