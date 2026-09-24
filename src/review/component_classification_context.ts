import path from "node:path";

import { generatedViews } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import { timeAsync } from "../diagnostics/timings.js";
import { generatedManifestRoutes } from "../registry/generated_routes.js";

import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentDependencyPolicy } from "./component_metadata.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { ComponentViewContext } from "./component_view.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { ResourceComparison } from "./resource_comparison.js";

/** Prepare both side-specific readers and prefetch the paired view documents. */
export async function prepareComponentComparison(
  input: ComponentClassificationInput,
): Promise<{
  context: ComponentViewContext;
  dependencies: ComponentDependencyPolicy;
}> {
  const { before, after, changedPaths, config } = input;
  const dependencies = new ComponentDependencyPolicy(
    before,
    after,
    config.review.sharedImpact,
  );
  const beforeReader = new ComponentMaterialReader(input.beforeReader, {
    prefix: before.schemaVersion === 6 ? ".generated" : "",
    routes: generatedManifestRoutes(before),
  });
  const afterReader = new ComponentMaterialReader(input.afterReader, {
    prefix: after.schemaVersion === 6 ? ".generated" : "",
    routes: generatedManifestRoutes(after),
  });
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
    compareResourceBytes: true,
    ...(input.useFastPath === undefined
      ? {}
      : { useFastPath: input.useFastPath }),
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
  return { context, dependencies };
}
