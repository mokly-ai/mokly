/** Project completed ownership evidence onto the one comparison being displayed. */
import type { ReviewResultV7 } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { aggregateIgnored } from "./screen_views.js";
import type { ReviewSelection } from "./selection_types.js";

export function selectedComponentResult(
  result: ReviewResultV7,
  selection: ReviewSelection,
): ReviewResultV7 {
  const screens = result.screens.filter(
    (screen) => screen.path === selection.path,
  );
  const component = result.components.find((entry) =>
    entry.variants.some((variant) => variant.path === selection.path),
  );
  const variant = component?.variants.find(
    (entry) => entry.path === selection.path,
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
      return address?.path === selection.path;
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
