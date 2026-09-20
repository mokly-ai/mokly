import assert from "node:assert/strict";
import test from "node:test";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../dist/server/client_modules.js";

const COMMENT = /\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g;
const IMPORT = /\b(?:from|import)\s*\(?\s*"([^"]+)"/g;

test("served browser modules import only modules served beside them", () => {
  const served = new Map([
    ["client", loadBrowserClientModules()],
    ["navigation", loadBrowserNavigationModules()],
  ]);
  const inspected: string[] = [];
  for (const [directory, modules] of served) {
    for (const [filename, source] of modules) {
      for (const specifier of importSpecifiers(source.toString("utf8"))) {
        inspected.push(specifier);
        const target = resolveSpecifier(specifier, directory);
        assert.ok(
          target,
          `${directory}/${filename} imports non-relative module ${specifier}`,
        );
        assert.ok(
          served.get(target.directory)?.has(target.filename),
          `${directory}/${filename} imports unserved module ${specifier}`,
        );
      }
    }
  }
  assert.ok(inspected.length > 0, "no browser import specifier was inspected");
  assert.ok(
    inspected.includes("../navigation/logical.js"),
    "no served module still imports across the client and navigation directories",
  );
  const clients = served.get("client");
  assert.ok(clients);
  assert.ok(clients.has("previews.js"));
  assert.match(
    clients.get("previews.js")?.toString("utf8") ?? "",
    /\.\/diffs\.js/,
  );
  assert.doesNotMatch(
    clients.get("browse_runtime.js")?.toString("utf8") ?? "",
    /function parseReviewResult/,
  );
  assert.equal(
    [...clients.values()].filter((source) =>
      source.toString("utf8").includes("function parseReviewResult"),
    ).length,
    1,
  );
  assert.equal(
    [...clients.values()].filter((source) =>
      source.toString("utf8").includes("function reviewInvalid"),
    ).length,
    1,
  );
});

function importSpecifiers(source: string): string[] {
  return [...source.replace(COMMENT, "").matchAll(IMPORT)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function resolveSpecifier(
  specifier: string,
  directory: string,
): { directory: string; filename: string } | undefined {
  const sibling = /^\.\/([\w.-]+\.js)$/.exec(specifier)?.[1];
  if (sibling !== undefined) return { directory, filename: sibling };
  const across = /^\.\.\/([\w-]+)\/([\w.-]+\.js)$/.exec(specifier);
  const [, acrossDirectory, acrossFilename] = across ?? [];
  if (acrossDirectory !== undefined && acrossFilename !== undefined)
    return { directory: acrossDirectory, filename: acrossFilename };
  return undefined;
}
