import path from "node:path";

import type { Manifest } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";

import { prefetchClassificationViews } from "./component_classification_entries.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentDependencyPolicy } from "./component_metadata.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { ComponentViewContext } from "./component_view.js";
import { CssResourceAnalysis } from "./css/resource_analysis.js";
import { baselinePathMapper, mapUsagePaths } from "./moves/identity.js";
import { catalogueLinkNormalizer } from "./moves/links.js";
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
  const componentAware = [...input.before.entries, ...after.entries].some(
    (entry) => entry.kind === "component" && !("variantOf" in entry),
  );
  const dependencies = new ComponentDependencyPolicy(
    before,
    after,
    config.review.sharedImpact,
  );
  const beforeReader = new ComponentMaterialReader(input.beforeReader);
  const afterReader = new ComponentMaterialReader(input.afterReader);
  const changed = new Set(changedPaths);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const moves = input.pairing?.moves ?? [];
  const mapBefore = baselinePathMapper(
    input.before.entries,
    after.entries,
    moves,
  );
  const context: ComponentViewContext = {
    componentAware,
    links: catalogueLinkNormalizer(
      input.before.entries,
      after.entries,
      moves,
      input.resources,
    ),
    beforeUsage: (usage) => mapUsagePaths(usage, mapBefore),
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
      input.resources,
      componentAware,
    ),
    ...(input.useStylePath === undefined
      ? {}
      : { useStylePath: input.useStylePath }),
    ...(input.useMaterialFingerprints === undefined
      ? {}
      : { useMaterialFingerprints: input.useMaterialFingerprints }),
    ...(input.resources ? { resourceIdentity: input.resources } : {}),
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
