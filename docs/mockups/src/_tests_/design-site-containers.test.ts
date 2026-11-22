/**
 * The container queries of the site mockups and of the site. The width
 * parity test compares the rules of width queries only, so this test holds
 * the container queries to the same contract: the site declares each one
 * exactly as the mockups do. A container query lets a part follow the space
 * at the reader's text size, such as the mobile bar's wordmark, which hides
 * where the bar cannot hold it.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  cssRules,
  repositoryRoot,
  siteStyles,
} from "./design-site-test-helpers";

/** Each container query of a source, as its condition and its rules. */
function containerQueries(source: string): string[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const match of css.matchAll(/@container ([^{]+)\{/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < css.length && depth > 0; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}") depth -= 1;
    }
    const inner = css.slice(match.index + match[0].length, end - 1);
    const rules = cssRules(inner).map(({ declarations, selector }) => {
      const lines = declarations
        .split(";")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter((line) => line.length > 0)
        .sort();
      return `${selector.trim().replace(/\s+/g, " ")} { ${lines.join("; ")} }`;
    });
    const condition = match[1]?.trim().replace(/\s+/g, " ") ?? "";
    found.push(`@container ${condition} ${rules.join(" ")}`);
  }
  return found.sort();
}

/** Every site stylesheet, in name order. */
function siteSheets(): string {
  const directory = resolve(repositoryRoot, "apps/site/src/styles");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".css"))
    .sort()
    .map((name) => readFileSync(resolve(directory, name), "utf8"))
    .join("\n");
}

test("the site declares each container query exactly as the mockups do", () => {
  const depicted = containerQueries(siteStyles());
  assert.ok(depicted.length > 0, "the mockups declare no container query");
  assert.deepEqual(containerQueries(siteSheets()), depicted);
});
