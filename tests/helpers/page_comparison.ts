import path from "node:path";

import { ComponentDependencyPolicy } from "../../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../../dist/review/component_resources.js";
import { compareComponentView } from "../../dist/review/component_view.js";
import { catalogueLinkNormalizer } from "../../dist/review/moves/links.js";
import { ResourceComparison } from "../../dist/review/resource_comparison.js";
import { generatedViews } from "../../packages/viewer/dist/components/views.js";

import { memoryReader, type FastPathFixture } from "./component_fast_path.js";
import { compareComponentView as delivered } from "./page_m6/component_view.js";

export function pageContext(
  fixture: FastPathFixture,
  componentAware = true,
  oracle?: "page_m6",
) {
  const beforeReader = new ComponentMaterialReader(
    memoryReader(fixture.beforeFiles),
  );
  const afterReader = new ComponentMaterialReader(
    memoryReader(fixture.afterFiles),
  );
  const changed = new Set(fixture.changedPaths);
  const prefix = path.relative(
    fixture.config.repoRoot,
    fixture.config.mockupsDir,
  );
  return {
    componentAware,
    ...(oracle === "page_m6"
      ? {}
      : {
          links: catalogueLinkNormalizer(
            fixture.before.entries,
            fixture.after.entries,
            [],
          ),
        }),
    beforeReader,
    afterReader,
    dependencies: new ComponentDependencyPolicy(
      fixture.before,
      fixture.after,
      [],
    ),
    changed,
    prefix,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      prefix,
      undefined,
      fixture.config.generatedOutput === "derived",
      componentAware,
    ),
    compareResourceBytes: fixture.config.generatedOutput === "derived",
  };
}

export async function comparePageFixture(
  fixture: FastPathFixture,
  oracle = false,
) {
  return (await comparePageViews(fixture, oracle)).map(
    ({ comparison }) => comparison,
  );
}

export async function comparePageViews(
  fixture: FastPathFixture,
  oracle = false,
  useFastPath = true,
  useMaterialFingerprints = true,
  oracleContext?: "page_m6",
) {
  const context = {
    ...pageContext(fixture, !oracle, oracle ? "page_m6" : oracleContext),
    useFastPath,
    useStylePath: false,
    useMaterialFingerprints,
  };
  const compare = oracle ? delivered : compareComponentView;
  const results = [];
  for (const entry of fixture.after.entries) {
    const previous = fixture.before.entries.find(
      ({ path: id }) => id === entry.path,
    )!;
    for (const after of generatedViews(entry)) {
      const before = generatedViews(previous).find(
        ({ path }) => path === after.path,
      )!;
      const root = "variantOf" in entry ? entry.variantOf : undefined;
      results.push({
        entryId: entry.path,
        path: after.path,
        comparison: await compare(context, before, after, root),
      });
    }
  }
  return results;
}
