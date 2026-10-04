import path from "node:path";

import { isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  ReviewResultV4,
  ScreenReviewV4,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import { runWithDocumentWork, timeAsync } from "../diagnostics/timings.js";

import { affectedConsumers } from "./component_affected.js";
import {
  propagateImplementations,
  propagateUseCases,
} from "./component_change_propagation.js";
import {
  entryDependencies,
  entryViews,
  prefetchClassificationViews,
} from "./component_classification_entries.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { compareComponentViews } from "./component_compare_views.js";
import {
  address,
  baselineForCurrentIdentities,
  ComponentDependencyPolicy,
  entryPairs,
  lexical,
  metadata,
  uniqueReasons,
} from "./component_metadata.js";
import { viewPairs } from "./component_pairing.js";
import { ComponentReasonSources } from "./component_reason_sources.js";
import {
  exactScreenCssReasons,
  propagateOwnedResources,
  resourceImpact,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import {
  classifyComponentVariants,
  componentVariantEntries,
} from "./component_variant_classification.js";
import { type ComponentViewContext } from "./component_view.js";
import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { ResourceComparison } from "./resource_comparison.js";
import { aggregateIgnored, aggregateState } from "./screen_views.js";

/** Internal classifier output for source validation and its regression fixtures. */
export interface ComponentClassificationWithSources {
  result: ReviewResultV4;
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
  const componentAware = [...input.before.entries, ...after.entries].some(
    (entry) => entry.kind === "component" && !isManifestComponentVariant(entry),
  );
  const { changedPaths, config } = input;
  const dependencies = new ComponentDependencyPolicy(
    before,
    after,
    config.review.sharedImpact,
  );
  const beforeReader = new ComponentMaterialReader(input.beforeReader);
  const afterReader = new ComponentMaterialReader(input.afterReader);
  const changed = new Set(changedPaths);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const compareResourceBytes = config.generatedOutput === "derived";
  const context: ComponentViewContext = {
    componentAware,
    beforeReader,
    afterReader,
    dependencies,
    changed,
    prefix,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      prefix,
      new CssResourceAnalysis(input.cssParser, undefined, input.cssCacheBytes),
      compareResourceBytes,
      componentAware,
    ),
    compareResourceBytes,
    ...(input.useFastPath === undefined
      ? {}
      : { useFastPath: input.useFastPath }),
    ...(input.useStylePath === undefined
      ? {}
      : { useStylePath: input.useStylePath }),
    ...(input.useMaterialFingerprints === undefined
      ? {}
      : { useMaterialFingerprints: input.useMaterialFingerprints }),
  };
  await prefetchClassificationViews(
    context,
    before,
    after,
    input.beforeReader.readMany !== undefined,
  );
  const sharedImpact = dependencies.sharedPaths(changedPaths);
  const screens: ScreenReviewV4[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedResourceReason[] = [];
  const reasonSources = new ComponentReasonSources();
  const pairs = entryPairs(before, after);
  const compare = async () => {
    for (const pair of pairs) {
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
      const baseViews = entryViews(pair.before, beforeVariantEntries);
      const headViews = entryViews(pair.after, afterVariantEntries);
      const pairedViews = viewPairs(baseViews, headViews);
      const compared = await compareComponentViews(
        context,
        pairedViews,
        entry.kind === "component" && !isManifestComponentVariant(entry)
          ? entry.id
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
          dependencies,
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
  };
  await timeAsync("review.compare-screens", () =>
    componentAware ? runWithDocumentWork(compare) : compare(),
  );
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
  const result: ReviewResultV4 = {
    schemaVersion: 4,
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
