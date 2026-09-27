import type {
  HistoricalManifestComponent,
  LegacyManifestComponentVariant,
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type {
  ChangedEntry,
  ComponentVariantReview,
  EntryChangeReason,
  GeneratedComponentView,
  ManifestEntry,
  generatedViews,
} from "@mokly/viewer/data";
import {
  canonicalJson,
  flattenComponentVariantEntries,
  isManifestComponentVariant,
} from "@mokly/viewer/data";

import {
  address,
  type ComponentDependencyPolicy,
  metadata,
  uniqueReasons,
} from "./component_metadata.js";
import { variantAddress } from "./component_pairing.js";
import type { ComponentReasonSources } from "./component_reason_sources.js";
import type { ComparedComponentView } from "./component_view.js";
import { aggregateState } from "./screen_views.js";

type ComponentParent = ManifestComponent | HistoricalManifestComponent;

interface VariantClassificationInput {
  before?: ComponentParent;
  after?: ComponentParent;
  entry: ComponentParent;
  compared: readonly ComparedComponentView[];
  pairedViews: readonly {
    before: GeneratedComponentView | undefined;
    after: GeneratedComponentView | undefined;
  }[];
  beforeEntries: ReadonlyMap<string, ManifestComponentVariant>;
  afterEntries: ReadonlyMap<string, ManifestComponentVariant>;
  dependencies: ComponentDependencyPolicy;
  reasonSources: ComponentReasonSources;
  changes: ChangedEntry[];
}

interface VariantClassification {
  parentReasons: readonly EntryChangeReason[];
  reviews: readonly ComponentVariantReview[];
}

/** Classify saved variant entries while retaining Review v3's grouped result. */
export function classifyComponentVariants(
  input: VariantClassificationInput,
): VariantClassification {
  const bases = variants(input.before);
  const heads = variants(input.after);
  const reviews: ComponentVariantReview[] = [];
  const parentReasons: EntryChangeReason[] = [];
  for (const id of [
    ...new Set([
      ...heads.map((variant) => variant.id),
      ...bases.map((variant) => variant.id),
    ]),
  ]) {
    const base = bases.find((variant) => variant.id === id);
    const head = heads.find((variant) => variant.id === id);
    const selected = (head ?? base)!;
    const comparisons = input.compared.filter(
      (_result, index) =>
        (input.pairedViews[index]!.after ?? input.pairedViews[index]!.before)
          ?.variantId === id,
    );
    const views = comparisons.map((result) => result.view);
    const beforeEntry = input.beforeEntries.get(id);
    const afterEntry = input.afterEntries.get(id);
    const reasons: EntryChangeReason[] = [];
    if (!base) reasons.push({ kind: "added" });
    if (!head) reasons.push({ kind: "removed" });
    const metadataChanged =
      Boolean(beforeEntry && afterEntry) &&
      (metadata(beforeEntry!) !== metadata(afterEntry!) ||
        input.before?.title !== input.after?.title);
    if (metadataChanged) reasons.push({ kind: "metadata" });
    const comparedReasons = comparisons.flatMap(
      (comparison) => comparison.reasons,
    );
    const parentDependencyEvidence = comparedReasons.some(
      (reason) =>
        reason.kind === "dependency" &&
        (input.dependencies.owners(reason.path).has(input.entry.id) ||
          comparisons.some((comparison) =>
            comparison.ownedResources.some(
              (owned) =>
                owned.componentId === input.entry.id &&
                owned.reason.path === reason.path,
            ),
          )),
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
          !input.dependencies.owners(reason.path).has(input.entry.id) &&
          !comparisons.some((comparison) =>
            comparison.ownedResources.some(
              (owned) =>
                owned.componentId === input.entry.id &&
                owned.reason.path === reason.path,
            ),
          ),
      );
    if (ownsViewChange) reasons.push(...comparedReasons);
    else if (comparedReasons.length > 0 && !parentDependencyEvidence)
      parentReasons.push(...comparedReasons);
    reviews.push({
      id,
      title: selected.title,
      ...(base ? { before: variantAddress(base) } : {}),
      ...(head ? { after: variantAddress(head) } : {}),
      state: aggregateState(views.map((view) => view.state)),
      views,
    });
    const selectedEntry = afterEntry ?? beforeEntry;
    if (reasons.length > 0 && selectedEntry) {
      const unique = uniqueReasons(reasons);
      input.changes.push({
        kind: "component",
        ...(beforeEntry ? { before: address(beforeEntry) } : {}),
        ...(afterEntry ? { after: address(afterEntry) } : {}),
        reasons: unique,
      });
      input.reasonSources.record(selectedEntry, unique);
    }
  }
  return { parentReasons, reviews };
}

/** Index current entries and normalized historical nested variants by global id. */
export function componentVariantEntries(
  entries: readonly ManifestEntry[],
): ReadonlyMap<string, ManifestComponentVariant> {
  return new Map(
    flattenComponentVariantEntries(entries).flatMap((entry) =>
      entry.kind === "component" && isManifestComponentVariant(entry)
        ? [[entry.id, entry] as const]
        : [],
    ),
  );
}

function variants(
  parent: ComponentParent | undefined,
): readonly LegacyManifestComponentVariant[] {
  return parent && "variants" in parent ? parent.variants : [];
}

function slotScopedInputsChanged(
  before: ReturnType<typeof generatedViews>[number] | undefined,
  after: ReturnType<typeof generatedViews>[number] | undefined,
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
