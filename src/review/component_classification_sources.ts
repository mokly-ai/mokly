import path from "node:path";

import { isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  ReviewResultV5,
  ScreenReviewV5,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import { timeAsync, timingCounts } from "../diagnostics/timings.js";

import { affectedConsumers } from "./component_affected.js";
import {
  propagateImplementations,
  propagateUseCases,
} from "./component_change_propagation.js";
import { classificationComparisons } from "./component_classification_comparisons.js";
import { prefetchClassificationViews } from "./component_classification_entries.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentComparisonCounts } from "./component_comparison_counts.js";
import {
  address,
  baselineForCurrentIdentities,
  entryPairs,
  lexical,
  metadata,
  uniqueReasons,
} from "./component_metadata.js";
import { ComponentReasonSources } from "./component_reason_sources.js";
import {
  propagateOwnedResources,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import {
  classifyComponentVariants,
  componentVariantEntries,
} from "./component_variant_classification.js";
import type { ComponentViewContext } from "./component_view.js";
import { assertViewAnalysisScope } from "./css/paths.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { ResourceComparison } from "./resource_comparison.js";
import { aggregateIgnored, aggregateState } from "./screen_views.js";

/** Internal classifier output for source validation and its regression fixtures. */
export interface ComponentClassificationWithSources {
  result: ReviewResultV5;
  implementationImpact: ReadonlySet<string>;
  sources: DependencyReasonSources;
}

/** Collect every dependency source before validating the assembled result. */
export async function classifyComponentsWithSources(
  input: ComponentClassificationInput,
): Promise<ComponentClassificationWithSources> {
  const before = baselineForCurrentIdentities(input.before, input.after);
  const after = input.after;
  const beforeVariantEntries = componentVariantEntries(before.entries);
  const afterVariantEntries = componentVariantEntries(after.entries);
  const { changedPaths, config } = input;
  const beforeReader = new ComponentMaterialReader(input.beforeReader);
  const afterReader = new ComponentMaterialReader(input.afterReader);
  const changed = new Set(changedPaths);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const compareResourceBytes = config.generatedOutput === "derived";
  const context: ComponentViewContext = {
    beforeReader,
    afterReader,
    changed,
    prefix,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      prefix,
      input.cssAnalysis ?? new CssResourceAnalysis(input.cssParser),
      compareResourceBytes,
    ),
    compareResourceBytes,
    ...(input.useFastPath === undefined
      ? {}
      : { useFastPath: input.useFastPath }),
  };
  await prefetchClassificationViews(
    context,
    before,
    after,
    input.beforeReader.readMany !== undefined,
  );
  const screens: ScreenReviewV5[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedResourceReason[] = [];
  const reasonSources = new ComponentReasonSources(
    context.resources.css.attribution,
  );
  const pairs = entryPairs(before, after);
  const comparisonCounts = new ComponentComparisonCounts();
  await timeAsync("review.compare-screens", async () => {
    const entries = await classificationComparisons(
      context,
      pairs,
      beforeVariantEntries,
      afterVariantEntries,
    );
    for (const { pair, pairedViews, compared } of entries) {
      const entry = (pair.after ?? pair.before)!;
      const sides = {
        ...(pair.before ? { before: address(pair.before) } : {}),
        ...(pair.after ? { after: address(pair.after) } : {}),
      };
      const reasons: EntryChangeReason[] = [];
      if (!pair.before) reasons.push({ kind: "added" });
      if (!pair.after) reasons.push({ kind: "removed" });
      if (
        pair.before &&
        pair.after &&
        metadata(pair.before) !== metadata(pair.after)
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
      if (entry.kind === "component" && !isManifestComponentVariant(entry)) {
        const classifiedVariants = classifyComponentVariants({
          ...(pair.before?.kind === "component" &&
          !isManifestComponentVariant(pair.before)
            ? { before: pair.before }
            : {}),
          ...(pair.after?.kind === "component" &&
          !isManifestComponentVariant(pair.after)
            ? { after: pair.after }
            : {}),
          entry,
          compared,
          pairedViews,
          beforeEntries: beforeVariantEntries,
          afterEntries: afterVariantEntries,
          reasonSources,
          changes,
        });
        const variants = classifiedVariants.reviews;
        reasons.push(...classifiedVariants.parentReasons);
        reasonSources.record(entry, classifiedVariants.parentReasons);
        if (classifiedVariants.parentReasons.length > 0)
          impacting.add(entry.id);
        if (
          reasons.some(
            (reason) =>
              reason.kind === "added" ||
              reason.kind === "removed" ||
              reason.kind === "dependency",
          )
        )
          impacting.add(entry.id);
        components.push({
          ...common,
          state: aggregateState(variants.map((variant) => variant.state)),
          variants,
        });
      }
      if (reasons.length)
        changes.push({
          kind: entry.kind,
          ...sides,
          reasons: uniqueReasons(reasons),
        });
    }
    timingCounts("review.compare-screens", () => comparisonCounts.record());
  });
  propagateOwnedResources(ownedResources, impacting, components, changes);
  reasonSources.recordOwnedResources(
    ownedResources,
    pairs.map((pair) => (pair.after ?? pair.before)!),
  );
  propagateImplementations(
    actualImplementations,
    impacting,
    components,
    changes,
  );
  propagateUseCases(pairs, before, after, changes);
  screens.sort((a, b) => lexical(a.id, b.id));
  components.sort((a, b) => lexical(a.id, b.id));
  changes.sort(
    (a, b) =>
      lexical(a.kind, b.kind) ||
      lexical((a.after ?? a.before)!.id, (b.after ?? b.before)!.id),
  );
  const result: ReviewResultV5 = {
    schemaVersion: 5,
    baseCommit: input.baseCommit,
    baseRef: input.baseRef,
    changedPaths: [...changedPaths].sort(),
    screens,
    components,
    changes,
    affectedConsumers: affectedConsumers(before, after, impacting),
    ignoredImpact: aggregateIgnored(screens),
  };
  return { result, implementationImpact: impacting, sources: reasonSources };
}
