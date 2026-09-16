import path from "node:path";

import { minimatch } from "minimatch";

import {
  canonicalJson,
  generatedViews,
  analyzeHierarchy,
} from "@mokly/viewer/data";
import type {
  ManifestEntry,
  ChangedEntry,
  ComponentReview,
  ComponentVariantReview,
  EntryChangeReason,
  ReviewResultV3,
  ScreenReviewV3,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import { timeAsync } from "../diagnostics/timings.js";

import { affectedConsumers } from "./component_affected.js";
import {
  propagateImplementations,
  propagateUseCases,
} from "./component_change_propagation.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import {
  address,
  ComponentDependencyPolicy,
  entryPairs,
  lexical,
  metadata,
  uniqueReasons,
} from "./component_metadata.js";
import { variantAddress, viewPairs } from "./component_pairing.js";
import {
  exactScreenCssReasons,
  propagateOwnedCss,
  resourceImpact,
  type OwnedCssReason,
} from "./component_resource_attribution.js";
import { ComponentMaterialReader } from "./component_resources.js";
import { validateComponentReviewSources } from "./component_result_sources.js";
import {
  compareComponentView,
  type ComponentViewContext,
} from "./component_view.js";
import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { ResourceComparison } from "./resource_comparison.js";
import { aggregateIgnored, aggregateState } from "./screen_views.js";

/** The sole component-aware membership policy, shared by Browse, Review, and publishing. */
export async function classifyComponents(
  input: ComponentClassificationInput,
): Promise<ReviewResultV3> {
  const { before, after, changedPaths, config } = input;
  const dependencies = new ComponentDependencyPolicy(
    before,
    after,
    config.review.sharedImpact,
  );
  const beforeReader = new ComponentMaterialReader(input.beforeReader);
  const afterReader = new ComponentMaterialReader(input.afterReader);
  const changed = new Set(changedPaths);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const context: ComponentViewContext = {
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
      new CssResourceAnalysis(input.cssParser),
    ),
    compareResourceBytes: config.generatedOutput === "derived",
  };
  const prefetchBefore = () =>
    context.beforeReader.prefetch(
      before.entries.flatMap((entry) =>
        generatedViews(entry).map((view) => view.path),
      ),
    );
  await Promise.all([
    input.beforeReader.readMany
      ? timeAsync("review.base-documents", prefetchBefore)
      : prefetchBefore(),
    context.afterReader.prefetch(
      after.entries.flatMap((entry) =>
        generatedViews(entry).map((view) => view.path),
      ),
    ),
  ]);
  const sharedImpact = changedPaths.filter((path) =>
    config.review.sharedImpact.some((glob) =>
      minimatch(path, glob, { dot: true }),
    ),
  );
  const screens: ScreenReviewV3[] = [];
  const components: ComponentReview[] = [];
  const changes: ChangedEntry[] = [];
  const impacting = new Set<string>();
  const actualImplementations = new Set<string>();
  const ownedResources: OwnedCssReason[] = [];
  const pairs = entryPairs(before, after);
  const beforeHierarchy = analyzeHierarchy<ManifestEntry>(
    before.entries as readonly ManifestEntry[],
  ).hierarchy;
  const afterHierarchy = analyzeHierarchy<ManifestEntry>(
    after.entries as readonly ManifestEntry[],
  ).hierarchy;
  await timeAsync("review.compare-screens", async () => {
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
        metadata(pair.before, before, beforeHierarchy) !==
          metadata(pair.after, after, afterHierarchy)
      )
        reasons.push({ kind: "metadata" });
      reasons.push(
        ...dependencies
          .reasons(pair.before, pair.after, changedPaths)
          .filter(
            (reason) =>
              reason.kind !== "dependency" ||
              !analysisOwnsStylesheet(reason.path, config),
          ),
      );
      const common = {
        ...address(entry),
        ...sides,
        dependencies: [
          ...new Set([
            ...(pair.before?.dependencies ?? []),
            ...(pair.after?.dependencies ?? []),
          ]),
        ].sort(),
        sharedImpact: [] as string[],
      };
      const baseViews = pair.before ? generatedViews(pair.before) : [];
      const headViews = pair.after ? generatedViews(pair.after) : [];
      const pairedViews = viewPairs(baseViews, headViews);
      const compared = await Promise.all(
        pairedViews.map((view) =>
          compareComponentView(
            context,
            view.before,
            view.after,
            entry.kind === "component" ? entry.id : undefined,
          ),
        ),
      );
      assertViewAnalysisScope(
        compared.map((result) => result.view),
        config,
      );
      reasons.push(...compared.flatMap((result) => result.reasons));
      reasons.push(
        ...exactScreenCssReasons(
          pair.before,
          pair.after,
          compared.map((result) => result.view),
        ),
      );
      common.sharedImpact = resourceImpact(sharedImpact, reasons);
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
      if (entry.kind === "component") {
        const bases =
          pair.before?.kind === "component" ? pair.before.variants : [];
        const heads =
          pair.after?.kind === "component" ? pair.after.variants : [];
        const variants: ComponentVariantReview[] = [];
        for (const id of [
          ...new Set([
            ...heads.map((variant) => variant.id),
            ...bases.map((variant) => variant.id),
          ]),
        ]) {
          const base = bases.find((variant) => variant.id === id);
          const head = heads.find((variant) => variant.id === id);
          const selected = (head ?? base)!;
          const variantComparisons = compared.filter(
            (_result, index) =>
              (pairedViews[index]!.after ?? pairedViews[index]!.before)
                ?.variantId === id,
          );
          const views = variantComparisons.map((result) => result.view);
          variants.push({
            id,
            title: selected.title,
            ...(base ? { before: variantAddress(base) } : {}),
            ...(head ? { after: variantAddress(head) } : {}),
            state: aggregateState(views.map((view) => view.state)),
            views,
          });
          if (
            base &&
            head &&
            canonicalJson(base.props) === canonicalJson(head.props) &&
            variantComparisons.some(
              (comparison) => comparison.reasons.length > 0,
            ) &&
            !reasons.some((reason) => reason.kind === "metadata")
          )
            impacting.add(entry.id);
        }
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
  });
  propagateOwnedCss(ownedResources, impacting, components, changes);
  propagateImplementations(
    actualImplementations,
    impacting,
    components,
    changes,
  );
  propagateUseCases(pairs, before, after, changes);
  screens.sort((a, b) => lexical(a.route, b.route));
  components.sort((a, b) => lexical(a.id, b.id));
  changes.sort(
    (a, b) =>
      lexical((a.after ?? a.before)!.route, (b.after ?? b.before)!.route) ||
      lexical(a.kind, b.kind) ||
      lexical((a.after ?? a.before)!.id, (b.after ?? b.before)!.id),
  );
  const result: ReviewResultV3 = {
    schemaVersion: 3,
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
  validateComponentReviewSources(result, before, after, impacting);
  return result;
}
