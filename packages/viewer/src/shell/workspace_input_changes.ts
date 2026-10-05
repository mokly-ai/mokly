// Supplied component inputs that differ between the retained baseline and the
// current render of one entry. Each difference names the instance, the view it
// was recorded in, and both serialized prop sets, so the inspector can show
// what an author changed without re-rendering either side.

import { branchPoints } from "../catalogue/branch_point.js";
import type { EntryIdentity } from "../catalogue/branch_point_types.js";
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
 * A variant's view and a nested component pair with their counterparts in the
 * baseline `inventory`, so a move or a case-only rename keeps its inputs. */
export function inputChanges(
  catalogue: Catalogue,
  entry: ManifestComponent | ManifestComponentVariant | ManifestScreen,
  baseline: ManifestEntry | undefined,
  inventory: readonly EntryIdentity[],
  currentVariants: readonly ManifestComponentVariant[] = [],
  baselineVariants: readonly ManifestComponentVariant[] = [],
): InputChange[] {
  const changes: InputChange[] = [];
  if (entry.kind === "screen" && !baseline) return changes;
  const afterViews =
    entry.kind === "component"
      ? currentVariants.flatMap((variant) => generatedViews(variant))
      : generatedViews(entry);
  const beforeViews =
    entry.kind === "component"
      ? baselineVariants.flatMap((variant) => generatedViews(variant))
      : baseline
        ? generatedViews(baseline)
        : [];
  const lookup = branchPoints(catalogue);
  const counterpart = (path: string) =>
    lookup.counterpart({ kind: "component", path }, inventory)?.path;
  for (const after of afterViews) {
    const variantPath =
      after.variantPath === undefined
        ? undefined
        : counterpart(after.variantPath);
    if (after.variantPath !== undefined && variantPath === undefined) continue;
    const before = beforeViews.find(
      (view) =>
        view.viewport === after.viewport &&
        view.colorScheme === after.colorScheme &&
        view.variantPath === variantPath,
    );
    for (const current of after.usage?.instances ?? []) {
      if (current.owner.kind !== "entry") continue;
      const baselineName = counterpart(current.componentId);
      const paired =
        baselineName === undefined
          ? undefined
          : before?.usage?.instances.find(
              (item) =>
                item.key === current.key && item.componentId === baselineName,
            );
      if (
        !paired ||
        JSON.stringify(paired.props) === JSON.stringify(current.props)
      )
        continue;
      changes.push({
        instanceId: current.id,
        title:
          lookup.usageComponent(current.componentId, "after")?.entry.title ??
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
