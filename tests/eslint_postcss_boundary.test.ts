import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

const eslint = new ESLint();
const guardedRules = new Set([
  "@typescript-eslint/no-restricted-imports",
  "no-restricted-syntax",
]);
const boundaryMessage =
  /src\/build\/styles\/postcss_boundary\.ts, which disables PostCSS source maps/;

async function violations(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages
    .filter((message) => guardedRules.has(message.ruleId ?? ""))
    .map((message) => message.message);
}

const bypasses = {
  "default import":
    'import postcss from "postcss";\nexport const root = postcss.parse("a{}", { from: "a.css" });\n',
  "parse import":
    'import { parse } from "postcss";\nexport const root = parse("a{}");\n',
  "Processor import":
    'import { Processor } from "postcss";\nexport const processor = new Processor([]);\n',
  "Input import":
    'import { Input } from "postcss";\nexport const input = new Input("a{}");\n',
  "namespace import":
    'import * as postcss from "postcss";\nexport const root = postcss.parse("a{}");\n',
  "re-export": 'export { parse } from "postcss";\n',
  "internal module":
    'import Input from "postcss/lib/input";\nexport const input = new Input("a{}");\n',
  "dynamic import": 'export const postcss = await import("postcss");\n',
  "require call":
    'import { createRequire } from "node:module";\nexport const postcss: unknown = createRequire(import.meta.url)("postcss");\n',
};

test("ESLint keeps PostCSS parsing and processing behind the source-map boundary", async () => {
  for (const filePath of [
    "src/build/styles/fixture.ts",
    "src/server/fixture.ts",
    "packages/viewer/src/fixture.ts",
  ])
    for (const [name, code] of Object.entries(bypasses)) {
      const messages = await violations(code, filePath);
      assert.equal(messages.length, 1, `${name} in ${filePath}`);
      assert.match(messages[0]!, boundaryMessage);
    }
});

test("ESLint allows PostCSS types, nodes, errors and plugin packages", async () => {
  const code = [
    'import { createRequire } from "node:module";',
    'import { CssSyntaxError, Rule, type Root } from "postcss";',
    'import type { Processor } from "postcss";',
    "export type Parsed = [Root, Processor];",
    'export const rule = new Rule({ selector: ".a" });',
    "export const failure = CssSyntaxError;",
    'export const plugin: unknown = createRequire(import.meta.url)("postcss-modules-scope");',
  ].join("\n");
  assert.deepEqual(await violations(code, "src/build/styles/fixture.ts"), []);
});

test("ESLint lets the boundary and tests import the PostCSS processor", async () => {
  const code =
    'import postcss from "postcss";\nexport const root = postcss.parse("a{}", { from: "a.css", map: false });\n';
  assert.deepEqual(
    await violations(code, "src/build/styles/postcss_boundary.ts"),
    [],
  );
  assert.deepEqual(await violations(code, "tests/fixture.test.ts"), []);
});

test("ESLint keeps locale path sorting checks beside PostCSS load checks", async () => {
  const messages = await violations(
    'export const paths = ["b", "a"].sort((a, b) => a.localeCompare(b));\n',
    "src/build/styles/fixture.ts",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /compareCodeUnits/);
});
