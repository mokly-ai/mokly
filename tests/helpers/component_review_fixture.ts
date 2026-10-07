import fs from "node:fs/promises";

import { baselineCatalogue } from "../../dist/baseline/catalogue.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import {
  generatedBytes,
  generatedText,
  type GeneratedFile,
} from "../../dist/build/generated_file.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";
import type { HistoricalManifest } from "../../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./component_fixture.js";
import { createFixture, removeFixture } from "./fixture.js";
import { textOutput } from "./generated_text.js";
import { assertMoveDelivery, commitMoveBaseline } from "./move_delivery.js";

export async function componentReviewFixture(
  t: { after: (fn: () => Promise<void>) => void },
  change: (source: string) => string,
  source = componentEntrySource(),
  extraConfig = 'colorSchemes: ["light", "dark"],',
  verifyMoveDelivery = false,
) {
  const fixture = await createFixture(source, { extraConfig });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  if (verifyMoveDelivery) await commitMoveBaseline(config, before);
  await fs.writeFile(fixture.entryPath, change(source));
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  if (verifyMoveDelivery) await assertMoveDelivery(config, after);
  const changedPaths = [
    "entries/fixture.mockup.tsx",
    ...[...after.outputs]
      .filter(([route, html]) => textOutput(before.outputs, route) !== html)
      .map(([route]) => `mockups/mokly-generated/${route}`),
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
    readonly outputs: ReadonlyMap<string, GeneratedFile>;
  },
  changedPaths: readonly string[] = [],
  inputs: ReadonlyMap<string, GeneratedFile> = new Map(),
): ReadOnlyReviewRepository {
  const commit = "a".repeat(40);
  const generated = compilation.manifest.schemaVersion === 9;
  const assetClosure =
    "assetClosure" in compilation.manifest
      ? compilation.manifest.assetClosure
      : [];
  const descriptor = baselineCatalogue(commit, "mockups", "generated-v9");
  const files = new Map(
    [...compilation.outputs].map(([route, html]) => [
      `mockups/${generated && !assetClosure.includes(route) ? "mokly-generated/" : ""}${route}`,
      html,
    ]),
  );
  for (const [file, bytes] of inputs) files.set(file, bytes);
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
      readFile: async (_commit, route) => generatedText(read(route), route)!,
      readFileBytes: async (_commit, route) => generatedBytes(read(route)),
    },
    descriptor,
  };
}
