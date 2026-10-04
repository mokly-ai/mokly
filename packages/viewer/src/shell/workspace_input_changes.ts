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
  variantPath?: string;
  before: ComponentWireProps;
  after: ComponentWireProps;
}

/** Compare matching views instance by instance; an unmatched view has nothing
 * to compare, and an unmatched instance is a structural change, not an input.
 * A moved variant's view and a moved nested component pair with their
 * branch-point paths. */
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
  const previous = (path: string) => catalogue.previousPaths.get(path) ?? path;
  for (const after of afterViews) {
    const variantPath =
      after.variantPath === undefined ? undefined : previous(after.variantPath);
    const before = beforeViews.find(
      (view) =>
        view.viewport === after.viewport &&
        view.colorScheme === after.colorScheme &&
        view.variantPath === variantPath,
    );
    for (const current of after.usage?.instances ?? []) {
      if (current.owner.kind !== "entry") continue;
      const componentId = previous(current.componentId);
      const paired = before?.usage?.instances.find(
        (item) => item.key === current.key && item.componentId === componentId,
      );
      if (
        !paired ||
        JSON.stringify(paired.props) === JSON.stringify(current.props)
      )
        continue;
      changes.push({
        instanceId: current.id,
        title:
          catalogue.byPath.get(current.componentId)?.title ??
          current.componentId,
        viewport: after.viewport,
        colorScheme: after.colorScheme,
        ...(after.variantPath ? { variantPath: after.variantPath } : {}),
        before: paired.props,
        after: current.props,
      });
    }
  }
  return changes;
}
