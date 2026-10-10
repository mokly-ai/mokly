import { isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  ReviewResultV7,
  ScreenReviewV7,
} from "@mokly/viewer/data";

import { runWithComparisonWork } from "../diagnostics/material_timings.js";
import {
  timeAsync,
  timingCounts,
  timingDocumentWork,
} from "../diagnostics/timings.js";
import { relatedDocumentReferences } from "../documents/references.js";

import { classificationComparisons } from "./component_classification_comparisons.js";
import { classificationContext } from "./component_classification_context.js";
import { finishComponentClassification } from "./component_classification_finish.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentComparisonCounts } from "./component_comparison_counts.js";
import {
  address,
  baselineForCurrentIdentities,
  entryPairs,
  metadata,
  variantParentTitleChanged,
  uniqueReasons,
} from "./component_metadata.js";
import { ComponentReasonSources } from "./component_reason_sources.js";
import { type OwnedResourceReason } from "./component_resource_attribution.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import {
  classifyComponentVariants,
  componentVariantEntries,
} from "./component_variant_classification.js";
import { assertViewAnalysisScope } from "./css/paths.js";
import { baselinePathMapper } from "./moves/identity.js";
import { prepareMoveClassification } from "./moves/prepare.js";
import { previousPathFields, type MovePairing } from "./moves/types.js";
import { aggregateState } from "./screen_views.js";

/** Internal classifier output for source validation and its regression fixtures. */
export interface ComponentClassificationWithSources {
  result: ReviewResultV7;
  implementationImpact: ReadonlySet<string>;
  sources: DependencyReasonSources;
  pairing: MovePairing;
}

/** Collect every dependency source before validating the assembled result. */
export async function classifyComponentsWithSources(
  input: ComponentClassificationInput,
): Promise<ComponentClassificationWithSources> {
  const prepared = await prepareMoveClassification(input);
  input = prepared;
  const pairing = prepared.pairing;
  const before = baselineForCurrentIdentities(
    input.before,
    input.after,
    pairing.moves,
  );
  const after = input.after;
  const mapBefore = baselinePathMapper(
    input.before.entries,
    after.entries,
    pairing.moves,
  );
  const beforeVariantEntries = componentVariantEntries(before.entries);
  const beforeDocuments = relatedDocumentReferences(before.entries, mapBefore);
  const afterDocuments = relatedDocumentReferences(after.entries);
  const afterVariantEntries = componentVariantEntries(after.entries);
  const { config } = input;
  const { context } = await classificationContext(
    { ...input, pairing },
    before,
    after,
  );
  const screens: ScreenReviewV7[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedResourceReason[] = [];
  const reasonSources = new ComponentReasonSources(
    context.resources.css.attribution,
  );
  const pairs = entryPairs(before, after, pairing.moves);
  const comparisonCounts = new ComponentComparisonCounts();
  const compare = async () => {
    const entries = await classificationComparisons(
      context,
      pairs,
      beforeVariantEntries,
      afterVariantEntries,
      pairing.moves,
    );
    for (const { pair, pairedViews, compared, grouped } of entries) {
      const entry = (pair.after ?? pair.before)!;
      const componentParent = [pair.after, pair.before].find(
        (candidate) =>
          candidate?.kind === "component" &&
          !isManifestComponentVariant(candidate),
      );
      if (entry.kind === "component" && !componentParent) continue;
      const sides = {
        ...previousPathFields(pair.before, pair.after),
        ...(pair.before ? { before: address(pair.before) } : {}),
        ...(pair.after ? { after: address(pair.after) } : {}),
      };
      const reasons: EntryChangeReason[] = [];
      if (!pair.before) reasons.push({ kind: "added" });
      if (!pair.after) reasons.push({ kind: "removed" });
      if (
        pair.before &&
        pair.after &&
        (metadata(pair.before, mapBefore, beforeDocuments) !==
          metadata(pair.after, undefined, afterDocuments) ||
          variantParentTitleChanged(pair.before, pair.after, before, after))
      )
        reasons.push({ kind: "metadata" });
      const common = {
        ...address(entry),
        ...sides,
      };
      comparisonCounts.add(compared);
      assertViewAnalysisScope(
        compared.map((result) => result.view),
        config,
      );
      const viewReasons = compared.flatMap((result) => result.reasons);
      if (entry.kind !== "component") {
        reasons.push(...viewReasons);
        reasonSources.record(entry, viewReasons);
      }
      ownedResources.push(
        ...compared.flatMap((result) => result.ownedResources),
      );
      for (const comparison of compared)
        for (const id of comparison.changedImplementations)
          actualImplementations.add(id);
      if (entry.kind === "screen")
        screens.push({
          ...common,
          state: aggregateState(compared.map((result) => result.view.state)),
          views: compared.map((result) => result.view),
        });
      if (
        componentParent?.kind === "component" &&
        !isManifestComponentVariant(componentParent)
      ) {
        const classifiedVariants = classifyComponentVariants({
          ...(pair.before?.kind === "component" &&
          !isManifestComponentVariant(pair.before)
            ? { before: pair.before }
            : {}),
          ...(pair.after?.kind === "component" &&
          !isManifestComponentVariant(pair.after)
            ? { after: pair.after }
            : {}),
          entry: componentParent,
          compared,
          pairedViews,
          pairs: grouped.variants ?? [],
          mapBefore,
          beforeDocuments,
          afterDocuments,
          reasonSources,
          changes,
        });
        const variants = classifiedVariants.reviews;
        reasons.push(...classifiedVariants.parentReasons);
        reasonSources.record(entry, classifiedVariants.parentReasons);
        if (classifiedVariants.parentReasons.length > 0)
          impacting.add(entry.path);
        if (
          reasons.some(
            (reason) =>
              reason.kind === "added" ||
              reason.kind === "removed" ||
              reason.kind === "dependency",
          )
        )
          impacting.add(entry.path);
        components.push({
          ...common,
          state:
            !variants.length && !pair.after
              ? "removed"
              : aggregateState(variants.map((variant) => variant.state)),
          variants,
        });
      }
      if (reasons.length || sides.previousPath)
        changes.push({
          kind: entry.kind,
          ...sides,
          reasons: uniqueReasons(reasons),
        });
    }
    if (!timingDocumentWork())
      timingCounts("review.compare-screens", () => comparisonCounts.record());
  };
  await timeAsync("review.compare-screens", () =>
    context.componentAware ? runWithComparisonWork(compare) : compare(),
  );
  return finishComponentClassification({
    request: input,
    before,
    after,
    pairs,
    pairing,
    screens,
    components,
    changes,
    ownedResources,
    impacting,
    actualImplementations,
    reasonSources,
  });
}
