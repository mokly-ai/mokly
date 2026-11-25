import fs from "node:fs/promises";
import path from "node:path";

/** The only module that reads the copied static example of global setup. */
const COPIED_HOST_MODULE = "tests/browser/static_test.ts";

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

/**
 * Return the spec files whose static relative import graph reaches the copied
 * host module. The graph over-approximates use, which only costs a build. A
 * specifier that resolves to no file is not a module import: such an import
 * would stop the Playwright run, so the graph skips it. A spec that reads the
 * copied host without this module fails at `copiedStaticUrl()` instead.
 */
export async function copiedHostSpecs(repositoryRoot, specFiles) {
  const target = path.resolve(repositoryRoot, COPIED_HOST_MODULE);
  const importers = new Map();
  const pending = specFiles.map((spec) => path.resolve(repositoryRoot, spec));
  const read = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (read.has(file) || file === target) continue;
    read.add(file);
    const text = await fs.readFile(file, "utf8");
    for (const match of text.matchAll(SPECIFIER)) {
      const imported = await resolveModule(path.dirname(file), match[1]);
      if (imported === undefined) continue;
      if (!importers.has(imported)) importers.set(imported, new Set());
      importers.get(imported).add(file);
      pending.push(imported);
    }
  }
  const reaching = new Set();
  const queue = [target];
  while (queue.length) {
    const file = queue.pop();
    if (reaching.has(file)) continue;
    reaching.add(file);
    queue.push(...(importers.get(file) ?? []));
  }
  return new Set(
    specFiles.filter((spec) =>
      reaching.has(path.resolve(repositoryRoot, spec)),
    ),
  );
}

async function resolveModule(directory, specifier) {
  const base = path.resolve(directory, specifier);
  const stem = base.replace(/\.(?:m?js|jsx)$/, "");
  for (const candidate of [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.mts`,
    path.join(base, "index.ts"),
  ])
    if (await isFile(candidate)) return candidate;
  return undefined;
}

async function isFile(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}
