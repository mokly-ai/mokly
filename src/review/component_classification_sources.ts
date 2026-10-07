import { isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  ReviewResultV6,
  ScreenReviewV6,
} from "@mokly/viewer/data";

import { runWithComparisonWork } from "../diagnostics/material_timings.js";
import { timeAsync } from "../diagnostics/timings.js";
import { relatedDocumentReferences } from "../documents/references.js";

import { classificationContext } from "./component_classification_context.js";
import { entryDependencies } from "./component_classification_entries.js";
import { finishComponentClassification } from "./component_classification_finish.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { compareComponentViews } from "./component_compare_views.js";
import {
  address,
  baselineForCurrentIdentities,
  entryPairs,
  metadata,
  variantParentTitleChanged,
  uniqueReasons,
} from "./component_metadata.js";
import { entryViewPairs } from "./component_pairing.js";
import { ComponentReasonSources } from "./component_reason_sources.js";
import {
  exactScreenCssReasons,
  resourceImpact,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import {
  classifyComponentVariants,
  componentVariantEntries,
} from "./component_variant_classification.js";
import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import { baselinePathMapper } from "./moves/identity.js";
import { prepareMoveClassification } from "./moves/prepare.js";
import { movedSourcePaths } from "./moves/source_moves.js";
import { previousPathFields, type MovePairing } from "./moves/types.js";
import { aggregateState } from "./screen_views.js";

/** Internal classifier output for source validation and its regression fixtures. */
export interface ComponentClassificationWithSources {
  result: ReviewResultV6;
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
  const sources = movedSourcePaths(input.before, after, pairing.moves);
  const mapSource = (path: string) => sources.get(path) ?? path;
  const beforeVariantEntries = componentVariantEntries(before.entries);
  const beforeDocuments = relatedDocumentReferences(before.entries, mapBefore);
  const afterDocuments = relatedDocumentReferences(after.entries);
  const afterVariantEntries = componentVariantEntries(after.entries);
  const componentAware = [...input.before.entries, ...after.entries].some(
    (entry) => entry.kind === "component" && !isManifestComponentVariant(entry),
  );
  const { changedPaths, config } = input;
  const { dependencies, context } = await classificationContext(
    { ...input, pairing },
    before,
    after,
  );
  const sharedImpact = dependencies.sharedPaths(changedPaths);
  const screens: ScreenReviewV6[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedResourceReason[] = [];
  const reasonSources = new ComponentReasonSources();
  const pairs = entryPairs(before, after, pairing.moves);
  const compare = async () => {
    for (const pair of pairs) {
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
        (metadata(pair.before, mapBefore, beforeDocuments, mapSource) !==
          metadata(pair.after, undefined, afterDocuments) ||
          variantParentTitleChanged(pair.before, pair.after, before, after))
      )
        reasons.push({ kind: "metadata" });
      const policyReasons = componentAware
        ? dependencies
            .reasons(pair.before, pair.after, changedPaths)
            .filter(
              (reason) =>
                reason.kind !== "dependency" ||
                !analysisOwnsStylesheet(reason.path, config),
            )
        : [];
      reasons.push(...policyReasons);
      reasonSources.record(entry, policyReasons);
      const common = {
        ...address(entry),
        ...sides,
        dependencies: [
          ...new Set([
            ...entryDependencies(pair.before),
            ...entryDependencies(pair.after),
          ]),
        ].sort(),
        sharedImpact: [] as string[],
      };
      const grouped = entryViewPairs(
        pair,
        beforeVariantEntries,
        afterVariantEntries,
        pairing.moves,
      );
      const pairedViews = grouped.views;
      const compared = await compareComponentViews(
        context,
        pairedViews,
        entry.kind === "component" && !isManifestComponentVariant(entry)
          ? entry.path
          : undefined,
      );
      assertViewAnalysisScope(
        compared.map((result) => result.view),
        config,
      );
      const viewReasons = compared.flatMap((result) => result.reasons);
      if (entry.kind !== "component") {
        reasons.push(...viewReasons);
        reasonSources.record(entry, viewReasons);
      }
      const exactCssReasons = exactScreenCssReasons(
        pair.before,
        pair.after,
        compared.map((result) => result.view),
      );
      if (entry.kind !== "component") {
        reasons.push(...exactCssReasons);
        reasonSources.record(entry, exactCssReasons);
      }
      const unownedEvidence = dependencies
        .unownedEvidence(pair.before, pair.after, changedPaths)
        .filter((path) => !analysisOwnsStylesheet(path, config));
      common.sharedImpact = resourceImpact(
        sharedImpact,
        unownedEvidence,
        reasons,
      );
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
          dependencies,
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
  };
  await timeAsync("review.compare-screens", () =>
    componentAware ? runWithComparisonWork(compare) : compare(),
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
    sharedImpact,
  });
}
