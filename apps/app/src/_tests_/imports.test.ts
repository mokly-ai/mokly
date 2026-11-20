import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

/** One import statement: what it names, and whether it names only types. */
interface Statement {
  module: string;
  types: boolean;
}

/**
 * The whole package: its modules and the Expo Router tree beside them, which
 * is application code the router imports and which the same rules hold over.
 */
const roots = ["apps/app/src", "apps/app/app"].map((tree) =>
  resolve(repositoryRoot, tree),
);

function sources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sources(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) found.push(path);
  }
  return found;
}

/**
 * Every import a file declares, in order.
 *
 * A statement is read from the line its `from` is on, which is enough here:
 * this package's imports are written by Prettier, so a statement's module
 * always closes it.
 */
function statements(text: string): Statement[] {
  const found: Statement[] = [];
  for (const match of text.matchAll(
    /^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";$/gm,
  )) {
    found.push({ module: match[2], types: match[1] !== undefined });
  }
  return found;
}

/**
 * One module, one import group — separately for what a file imports as values
 * and what it imports as types, because `verbatimModuleSyntax` makes those two
 * different statements and this package writes them that way on purpose.
 *
 * Two statements of the same kind are not a style question: the second hides
 * what the first already brought in, so a reader checking whether a module is
 * used reads one group and stops. Reviewers found a file importing from one
 * module three times, and two conflict resolutions added a duplicate where the
 * eye happened to be — which is how a merge spreads it.
 */
test("a file imports each module once for values and once for types", () => {
  const doubled: string[] = [];
  for (const path of roots.flatMap(sources)) {
    const seen = new Set<string>();
    for (const statement of statements(readFileSync(path, "utf8"))) {
      const key = `${statement.types ? "type" : "value"} ${statement.module}`;
      if (seen.has(key)) {
        doubled.push(`${relative(repositoryRoot, path)} imports ${key} twice`);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(doubled, []);
});
