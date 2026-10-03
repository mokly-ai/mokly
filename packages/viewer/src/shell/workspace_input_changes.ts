// Supplied component inputs that differ between the retained baseline and the
// current render of one entry. Each difference names the instance, the view it
// was recorded in, and both serialized prop sets, so the inspector can show
// what an author changed without re-rendering either side.

import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ComponentWireProps } from "../components/prop_types.js";
import { generatedViews } from "../components/views.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";

/** One instance whose supplied props differ from the baseline render. */
export interface InputChange {
  instanceId: string;
  title: string;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  variantId?: string;
  before: ComponentWireProps;
  after: ComponentWireProps;
}

/** Compare matching views instance by instance; an unmatched view has nothing
 * to compare, and an unmatched instance is a structural change, not an input. */
export function inputChanges(
  catalogue: Catalogue,
  entry: ManifestComponent | ManifestComponentVariant | ManifestScreen,
  baseline: ManifestEntry | undefined,
  currentVariants: readonly ManifestComponentVariant[] = [],
  baselineVariants: readonly ManifestComponentVariant[] = [],
): InputChange[] {
  const changes: InputChange[] = [];
  if (!baseline) return changes;
  const afterViews =
    entry.kind === "component"
      ? currentVariants.flatMap((variant) => generatedViews(variant))
      : generatedViews(entry);
  const beforeViews =
    baseline.kind === "component"
      ? baselineVariants.flatMap((variant) => generatedViews(variant))
      : generatedViews(baseline);
  for (const after of afterViews) {
    const before = beforeViews.find(
      (view) =>
        view.viewport === after.viewport &&
        view.colorScheme === after.colorScheme &&
        view.variantId === after.variantId,
    );
    for (const current of after.usage?.instances ?? []) {
      if (current.owner.kind !== "entry") continue;
      const previous = before?.usage?.instances.find(
        (item) =>
          item.key === current.key && item.componentId === current.componentId,
      );
      if (
        !previous ||
        JSON.stringify(previous.props) === JSON.stringify(current.props)
      )
        continue;
      changes.push({
        instanceId: current.id,
        title:
          catalogue.byId.get(current.componentId)?.title ?? current.componentId,
        viewport: after.viewport,
        colorScheme: after.colorScheme,
        ...(after.variantId ? { variantId: after.variantId } : {}),
        before: previous.props,
        after: current.props,
      });
    }
  }
  return changes;
}
