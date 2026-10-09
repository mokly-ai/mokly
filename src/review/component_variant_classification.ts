import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type {
  ChangedEntry,
  ComponentVariantReview,
  EntryChangeReason,
  GeneratedComponentView,
  ManifestEntry,
  HistoricalManifestEntry,
} from "@mokly/viewer/data";
import { canonicalJson, isManifestComponentVariant } from "@mokly/viewer/data";

import { address, metadata, uniqueReasons } from "./component_metadata.js";
import { variantAddress } from "./component_pairing.js";
import type { ComponentReasonSources } from "./component_reason_sources.js";
import type { ComponentVariantPair } from "./component_variant_pairs.js";
import type { ComparedComponentView } from "./component_view_types.js";
import { previousPathFields } from "./moves/types.js";
import { aggregateState } from "./screen_views.js";
import type { reviewViews } from "./views.js";

type ComponentParent = ManifestComponent;
type ReviewComponentVariant = ManifestComponentVariant;

interface VariantClassificationInput {
  before?: ComponentParent;
  after?: ComponentParent;
  entry: ComponentParent;
  compared: readonly ComparedComponentView[];
  pairedViews: readonly {
    before: GeneratedComponentView | undefined;
    after: GeneratedComponentView | undefined;
  }[];
  pairs: readonly ComponentVariantPair[];
  mapBefore: (path: string) => string;
  beforeDocuments: (source: string) => string;
  afterDocuments: (source: string) => string;
  reasonSources: ComponentReasonSources;
  changes: ChangedEntry[];
}

interface VariantClassification {
  parentReasons: readonly EntryChangeReason[];
  reviews: readonly ComponentVariantReview[];
}

/** Classify variant entries while retaining Review v7's grouped component result. */
export function classifyComponentVariants(
  input: VariantClassificationInput,
): VariantClassification {
  const reviews: ComponentVariantReview[] = [];
  const parentReasons: EntryChangeReason[] = [];
  for (const { before: base, after: head } of input.pairs) {
    const selected = (head ?? base)!;
    const id = selected.path;
    const comparisons = input.compared.filter((_result, index) => {
      const pair = input.pairedViews[index]!;
      const variant = pair.after ? head : base;
      return (
        variant !== undefined &&
        (pair.after ?? pair.before)?.variantPath?.toLowerCase() ===
          variant.path.toLowerCase()
      );
    });
    const views = comparisons.map((result) => result.view);
    const beforeEntry = base;
    const afterEntry = head;
    const moved = previousPathFields(base, head);
    const reasons: EntryChangeReason[] = [];
    if (!base) reasons.push({ kind: "added" });
    if (!head) reasons.push({ kind: "removed" });
    const metadataChanged =
      Boolean(beforeEntry && afterEntry) &&
      (metadata(beforeEntry!, input.mapBefore, input.beforeDocuments) !==
        metadata(afterEntry!, undefined, input.afterDocuments) ||
        input.before?.title !== input.after?.title);
    if (metadataChanged) reasons.push({ kind: "metadata" });
    const comparedReasons = comparisons.flatMap(
      (comparison) => comparison.reasons,
    );
    const parentDependencyEvidence = comparedReasons.some(
      (reason) =>
        reason.kind === "dependency" &&
        comparisons.some((comparison) =>
          comparison.ownedResources.some(
            (owned) =>
              owned.componentId === input.entry.path &&
              owned.reason.path === reason.path,
          ),
        ),
    );
    const ownsViewChange =
      !base ||
      !head ||
      metadataChanged ||
      (comparedReasons.some(
        (reason) => reason.kind === "inputs" || reason.kind === "structure",
      ) &&
        comparisons.some((comparison) => {
          const pair = input.pairedViews[input.compared.indexOf(comparison)];
          return pair
            ? slotScopedInputsChanged(pair.before, pair.after)
            : false;
        })) ||
      comparedReasons.some(
        (reason) =>
          reason.kind === "dependency" &&
          !comparisons.some((comparison) =>
            comparison.ownedResources.some(
              (owned) =>
                owned.componentId === input.entry.path &&
                owned.reason.path === reason.path,
            ),
          ),
      );
    if (ownsViewChange) reasons.push(...comparedReasons);
    else if (comparedReasons.length > 0 && !parentDependencyEvidence)
      parentReasons.push(...comparedReasons);
    const rootCss = comparisons.flatMap(
      (comparison) => comparison.componentCssReasons ?? [],
    );
    reasons.push(...rootCss);
    parentReasons.push(...rootCss);
    reviews.push({
      path: id,
      ...moved,
      title: selected.title,
      ...(base ? { before: variantAddress(base) } : {}),
      ...(head ? { after: variantAddress(head) } : {}),
      state: aggregateState(views.map((view) => view.state)),
      views,
    });
    const selectedEntry = afterEntry ?? beforeEntry;
    if ((reasons.length > 0 || moved.previousPath) && selectedEntry) {
      const unique = uniqueReasons(reasons);
      input.changes.push({
        kind: "component",
        ...moved,
        ...(beforeEntry ? { before: address(beforeEntry) } : {}),
        ...(afterEntry ? { after: address(afterEntry) } : {}),
        reasons: unique,
      });
      input.reasonSources.record(selectedEntry, unique);
    }
  }
  return { parentReasons, reviews };
}

/** Index current or historical-v10 flattened variants by case-folded path. */
export function componentVariantEntries(
  entries: readonly (ManifestEntry | HistoricalManifestEntry)[],
): ReadonlyMap<string, ReviewComponentVariant> {
  return new Map(
    entries.flatMap((entry) =>
      entry.kind === "component" && isManifestComponentVariant(entry)
        ? [[entry.path.toLowerCase(), entry] as const]
        : [],
    ),
  );
}

function slotScopedInputsChanged(
  before: ReturnType<typeof reviewViews>[number] | undefined,
  after: ReturnType<typeof reviewViews>[number] | undefined,
): boolean {
  const scoped = (view: typeof before) =>
    view?.usage?.instances
      .filter(
        (instance) =>
          instance.owner.kind === "entry" && instance.slotKey !== undefined,
      )
      .map((instance) => [
        instance.key,
        instance.componentId,
        instance.propsKey,
        instance.order,
        instance.slotKey,
      ]) ?? [];
  return canonicalJson(scoped(before)) !== canonicalJson(scoped(after));
}
