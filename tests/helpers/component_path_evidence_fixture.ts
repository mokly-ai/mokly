import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { compareReview } from "../../dist/review/compare.js";
import type { ReviewResultV7 } from "../../packages/viewer/dist/review/component_types.js";

import { componentEntrySource } from "./component_fixture.js";
import { componentGit } from "./component_review_fixture.js";
import { createFixture, removeFixture } from "./fixture.js";

export interface PathEvidenceCase {
  beforeSource: string;
  afterSource?: string;
  changedPaths: readonly string[];
  sharedGlobs: readonly string[];
}

/** One screen, two registered components, and a flow using that screen. */
export function pathCatalogueSource(
  dependencies: readonly string[] = [],
): string {
  return componentEntrySource()
    .replace(
      "defineComponent, defineScreen,",
      "defineComponent, defineScreen, defineUseCase,",
    )
    .replace(
      "const metadata = { relatedDocs: [] };",
      `const metadata = { dependencies: ${JSON.stringify(dependencies)}, relatedDocs: [] };`,
    )
    .replace('path: "home",', 'path: "home", useCasePaths: ["journey"],')
    .replace(
      "\n];",
      ',\n  defineUseCase({ ...metadata, path: "journey", title: "Journey", description: "A screen journey", steps: [{ screenPath: "home" }] })\n];',
    );
}

/** Override the explicit declarations of one fixture entry. */
export function withEntryPaths(
  source: string,
  id: "action" | "pane" | "home",
  dependencies: readonly string[],
  ownedDependencies: readonly string[] = [],
): string {
  const marker = `path: "${id}",`;
  if (!source.includes(marker)) throw new Error(`Missing fixture entry ${id}`);
  return source.replace(
    marker,
    `${marker} dependencies: ${JSON.stringify(dependencies)},${ownedDependencies.length ? ` ownedDependencies: ${JSON.stringify(ownedDependencies)},` : ""}`,
  );
}

/** Compare real compiled manifests against isolated changed-path evidence. */
export async function pathEvidenceFixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  options: PathEvidenceCase,
) {
  const fixture = await createFixture(options.beforeSource);
  t.after(() => removeFixture(fixture));
  for (const changed of options.changedPaths) {
    const file = path.join(fixture.root, changed);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `Baseline for ${changed}\n`);
  }
  const configSource = await fs.readFile(fixture.configPath, "utf8");
  await fs.writeFile(
    fixture.configPath,
    configSource.replace(
      "review: {",
      `review: { sharedImpact: ${JSON.stringify(options.sharedGlobs)},`,
    ),
  );
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  if (options.afterSource && options.afterSource !== options.beforeSource)
    await fs.writeFile(fixture.entryPath, options.afterSource);
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const artifact = await compareReview(
    after,
    config,
    componentGit(before, options.changedPaths),
    "main",
  );
  if (artifact.result.schemaVersion !== 7)
    throw new Error("Fixture requires a component review result");
  return { before, after, config, result: artifact.result as ReviewResultV7 };
}
