import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

function sources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_tests_") found.push(...sources(path));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      found.push(path);
    }
  }
  return found;
}

function hasRuntimeViewerImport(source: string): boolean {
  const staticImport = [
    ...source.matchAll(/import\s+(type\s+)?[^;]+from\s+"@mokly\/viewer";/g),
  ].some((match) => match[1] === undefined);
  return (
    staticImport ||
    /import\("@mokly\/viewer"\)/.test(source) ||
    /require\("@mokly\/viewer"\)/.test(source)
  );
}

test("the DOM viewer runtime stays outside every native Metro graph", () => {
  const root = resolve(repositoryRoot, "apps/app/src");
  const files = sources(root);
  const runtimeImports = files
    .filter((path) => hasRuntimeViewerImport(readFileSync(path, "utf8")))
    .map((path) => relative(root, path))
    .sort();
  assert.deepEqual(runtimeImports, [
    "viewer/catalogue-source.web.ts",
    "viewer/published.web.tsx",
  ]);

  const deepImports = files.flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(/"(@mokly\/viewer\/[^"\n]+)"/g)].map(
      (match) => `${relative(root, path)}: ${match[1]}`,
    );
  });
  assert.deepEqual(deepImports, []);

  const nativeHandoff = readFileSync(
    resolve(root, "viewer/handoff.ts"),
    "utf8",
  );
  const webHandoff = readFileSync(
    resolve(root, "viewer/handoff.web.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    nativeHandoff,
    /\b(?:document|window|requestAnimationFrame)\b/,
  );
  assert.match(webHandoff, /document\.addEventListener/);
});
