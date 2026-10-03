import path from "node:path";

import type { Manifest } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";

import { prefetchClassificationViews } from "./component_classification_entries.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentDependencyPolicy } from "./component_metadata.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { ComponentViewContext } from "./component_view.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { ResourceComparison } from "./resource_comparison.js";

/** Bind generation-local readers, resources and dependency ownership before comparison. */
export async function classificationContext(
  input: ComponentClassificationInput,
  before: Manifest,
  after: Manifest,
): Promise<{
  dependencies: ComponentDependencyPolicy;
  context: ComponentViewContext;
}> {
  const { config, changedPaths } = input;
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
  return { dependencies, context };
}
