import fs from "node:fs/promises";

import { baselineCatalogue } from "../../dist/baseline/catalogue.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";
import type { HistoricalManifest } from "../../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./component_fixture.js";
import { createFixture, removeFixture } from "./fixture.js";

export async function componentReviewFixture(
  t: { after: (fn: () => Promise<void>) => void },
  change: (source: string) => string,
  source = componentEntrySource(),
  extraConfig = 'colorSchemes: ["light", "dark"],',
) {
  const fixture = await createFixture(source, { extraConfig });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(fixture.entryPath, change(source));
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const changedPaths = [
    "entries/fixture.mockup.tsx",
    ...[...after.outputs]
      .filter(([route, html]) => before.outputs.get(route) !== html)
      .map(([route]) => `mockups/.generated/${route}`),
  ];
  return {
    ...fixture,
    config,
    before,
    after,
    git: componentGit(before, changedPaths),
    changedPaths,
  };
}

export function componentGit(
  compilation: {
    readonly manifest: HistoricalManifest;
    readonly outputs: ReadonlyMap<string, string>;
  },
  changedPaths: readonly string[] = [],
): ReadOnlyReviewRepository {
  const commit = "a".repeat(40);
  const generated = compilation.manifest.schemaVersion === 6;
  const assetClosure =
    "assetClosure" in compilation.manifest
      ? compilation.manifest.assetClosure
      : [];
  const descriptor = baselineCatalogue(
    commit,
    "mockups",
    generated ? "generated-v6" : "legacy",
  );
  const files = new Map(
    [...compilation.outputs].map(([route, html]) => [
      `mockups/${generated && !assetClosure.includes(route) ? ".generated/" : ""}${route}`,
      html,
    ]),
  );
  const read = (route: string) => {
    const result = files.get(route);
    if (result === undefined) throw new Error(`Missing fixture: ${route}`);
    return result;
  };
  return {
    evidence: {
      mergeBase: async () => commit,
      changedPaths: async () => changedPaths,
    },
    reader: {
      catalogue: descriptor,
      fileExists: async (_commit, route) => files.has(route),
      fileKind: async (_commit, route) =>
        files.has(route) ? "regular" : "missing",
      readFile: async (_commit, route) => read(route),
      readFileBytes: async (_commit, route) => Buffer.from(read(route)),
    },
    descriptor,
  };
}
