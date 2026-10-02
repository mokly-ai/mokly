import fs from "node:fs/promises";

import { scanImportPrelude } from "./prelude.js";

/** Find renderer-owned imports below a kept intermediate, without invoking plugins. */
export async function nestedExcludedImports(
  source: string,
  prunedSource: string,
  excluded: ReadonlySet<string>,
  resolveImport: (
    specifier: string,
    importer: string,
  ) => Promise<string | undefined>,
): Promise<ReadonlyMap<string, string>> {
  const found = new Map<string, string>();
  const visited = new Set<string>();
  const visit = async (
    file: string,
    text: string,
    depth: number,
  ): Promise<void> => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const entry of scanImportPrelude(text)) {
      const imported = await resolveImport(entry.specifier, file);
      if (!imported) continue;
      if (excluded.has(imported)) {
        if (depth > 0) found.set(imported, file);
        continue;
      }
      await visit(imported, await fs.readFile(imported, "utf8"), depth + 1);
    }
  };
  await visit(source, prunedSource, 0);
  return found;
}
