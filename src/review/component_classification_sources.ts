import { isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  ReviewResultV5,
  ScreenReviewV5,
} from "@mokly/viewer/data";

import { timeAsync, timingCounts } from "../diagnostics/timings.js";

import { affectedConsumers } from "./component_affected.js";
import {
  propagateImplementations,
  propagateUseCases,
} from "./component_change_propagation.js";
import { classificationContext } from "./component_classification_context.js";
import {
  entryDependencies,
  entryViews,
} from "./component_classification_entries.js";
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
import { viewPairs } from "./component_pairing.js";
import { ComponentReasonSources } from "./component_reason_sources.js";
import {
  exactScreenCssReasons,
  propagateOwnedCss,
  resourceImpact,
  type OwnedCssReason,
} from "./component_resource_attribution.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import {
  classifyComponentVariants,
  componentVariantEntries,
} from "./component_variant_classification.js";
import { compareComponentView } from "./component_view.js";
import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import { pairedEntryChanges } from "./entry_changes.js";
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
  const componentAware = [...before.entries, ...after.entries].some(
    (entry) => entry.kind === "component" && !isManifestComponentVariant(entry),
  );
  const { changedPaths, config } = input;
  const { dependencies, context } = await classificationContext(
    input,
    before,
    after,
  );
  const sharedImpact = dependencies.sharedPaths(changedPaths);
  const screens: ScreenReviewV5[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedCssReason[] = [];
  const reasonSources = new ComponentReasonSources();
  const pairs = entryPairs(before, after);
  const comparisonCounts = new ComponentComparisonCounts();
  await timeAsync("review.compare-screens", async () => {
    for (const pair of pairs) {
      const entry = (pair.after ?? pair.before)!;
      const componentParent = [pair.after, pair.before].find(
        (candidate) =>
          candidate?.kind === "component" &&
          !isManifestComponentVariant(candidate),
      );
      if (entry.kind === "component" && !componentParent) continue;
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
      const baseViews = entryViews(
        pair.before?.kind === "component" &&
          isManifestComponentVariant(pair.before)
          ? undefined
          : pair.before,
        beforeVariantEntries,
      );
      const headViews = entryViews(
        pair.after?.kind === "component" &&
          isManifestComponentVariant(pair.after)
          ? undefined
          : pair.after,
        afterVariantEntries,
      );
      const pairedViews = viewPairs(baseViews, headViews);
      const compared = await Promise.all(
        pairedViews.map((view) =>
          compareComponentView(
            context,
            view.before,
            view.after,
            entry.kind === "component" && !isManifestComponentVariant(entry)
              ? entry.path
              : undefined,
          ),
        ),
      );
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
          beforeEntries: beforeVariantEntries,
          afterEntries: afterVariantEntries,
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
  propagateOwnedCss(ownedResources, impacting, components, changes);
  reasonSources.recordOwnedCss(
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
  screens.sort((a, b) => lexical(a.path, b.path));
  components.sort((a, b) => lexical(a.path, b.path));
  changes.splice(0, changes.length, ...pairedEntryChanges(changes, pairs));
  changes.sort(
    (a, b) =>
      lexical(a.kind, b.kind) ||
      lexical((a.after ?? a.before)!.path, (b.after ?? b.before)!.path),
  );
  const result: ReviewResultV5 = {
    schemaVersion: 5,
    baseCommit: input.baseCommit,
    baseRef: input.baseRef,
    changedPaths: [...changedPaths].sort(),
    sharedImpact,
    screens,
    components,
    changes,
    affectedConsumers: affectedConsumers(before, after, impacting),
    ignoredImpact: aggregateIgnored(screens),
  };
  return { result, implementationImpact: impacting, sources: reasonSources };
}
