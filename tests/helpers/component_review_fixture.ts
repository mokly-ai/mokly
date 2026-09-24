import fs from "node:fs/promises";

import {
  compileCatalogue,
  type Compilation,
} from "../../dist/build/compile.js";
import { generatedBytes } from "../../dist/build/generated_file.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";

import { componentEntrySource } from "./component_fixture.js";
import { createFixture, removeFixture } from "./fixture.js";
import { textOutput } from "./generated_text.js";

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
      .filter(([route, html]) => textOutput(before.outputs, route) !== html)
      .map(([route]) => `mockups/${route}`),
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
  compilation: Compilation,
  changedPaths: readonly string[] = [],
): ReadOnlyReviewRepository {
  const files = new Map(
    [...compilation.outputs].map(([route, html]) => [`mockups/${route}`, html]),
  );
  const read = (route: string) => {
    const result = files.get(route);
    if (result === undefined) throw new Error(`Missing fixture: ${route}`);
    return result;
  };
  return {
    evidence: {
      mergeBase: async () => "a".repeat(40),
      changedPaths: async () => changedPaths,
    },
    reader: {
      fileExists: async (_commit, route) => files.has(route),
      fileKind: async (_commit, route) =>
        files.has(route) ? "regular" : "missing",
      readFile: async (_commit, route) =>
        textOutput(compilation.outputs, route.slice("mockups/".length))!,
      readFileBytes: async (_commit, route) => generatedBytes(read(route)),
    },
  };
}
