import path from "node:path";

import type { Manifest } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";

import { prefetchClassificationViews } from "./component_classification_entries.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { ComponentViewContext } from "./component_view_types.js";
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
  context: ComponentViewContext;
}> {
  const { config, changedPaths } = input;
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
    links: catalogueLinkNormalizer(
      input.before.entries,
      after.entries,
      moves,
      input.resources,
    ),
    beforeUsage: (usage) => mapUsagePaths(usage, mapBefore),
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
      input.resources,
    ),
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
  return { context };
}
