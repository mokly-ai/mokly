import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";

const helper = "src/build/styles/postcss_calls.ts";
const eslint = new ESLint({ cwd: repositoryRoot });

async function lint(code: string, file: string) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repositoryRoot, file),
  });
  return result!.messages;
}

async function restrictions(code: string, file: string): Promise<number> {
  return (await lint(code, file)).filter((message) =>
    message.message.includes(helper),
  ).length;
}

const forbidden = [
  'import postcss from "postcss";',
  'import postcss, { type Root } from "postcss";',
  'import { parse } from "postcss";',
  'import { Processor } from "postcss";',
  'import { Input } from "postcss";',
  'import { fromJSON } from "postcss";',
  'import * as postcss from "postcss";',
  'import parse from "postcss/lib/parse";',
  'export { parse } from "postcss";',
  'await import("postcss");',
  'await import("postcss/lib/parse");',
  'createRequire(import.meta.url)("postcss");',
];

const allowed = [
  'import { CssSyntaxError, Rule, type Root } from "postcss";',
  'import type postcss from "postcss";',
  'import { type Processor } from "postcss";',
  'import type { LazyResult } from "postcss/lib/lazy-result";',
  'requireValueParser("postcss-value-parser");',
];

test("ESLint rejects direct PostCSS parser and processor access in Mokly source", async () => {
  for (const file of [
    "src/build/styles/fixture.ts",
    "src/review/fixture.ts",
    "src/renderer/fixture.tsx",
  ])
    for (const code of forbidden)
      assert.equal(await restrictions(code, file), 1, `${file}: ${code}`);
  const required = await lint(
    'import postcss = require("postcss");',
    "src/review/fixture.ts",
  );
  assert.ok(
    required.some(
      (message) => message.ruleId === "@typescript-eslint/no-require-imports",
    ),
  );
});

test("ESLint allows PostCSS types, nodes and errors in Mokly source", async () => {
  for (const code of allowed)
    assert.equal(
      await restrictions(code, "src/build/styles/fixture.ts"),
      0,
      code,
    );
});

test("only the helper and tests may import PostCSS's parser and processor", async () => {
  await fs.access(path.join(repositoryRoot, helper));
  const code = 'import postcss from "postcss";';
  assert.equal(await restrictions(code, helper), 0);
  assert.equal(await restrictions(code, "tests/fixture.test.ts"), 0);
  assert.equal(await restrictions('await import("postcss");', helper), 1);
});

test("every Mokly source file except the helper keeps both PostCSS restrictions", async () => {
  const files = (
    await fs.readdir(path.join(repositoryRoot, "src"), { recursive: true })
  )
    .map((entry) => path.posix.join("src", entry.split(path.sep).join("/")))
    .filter((file) => /\.tsx?$/.test(file) && file !== helper);
  assert.ok(files.length > 100, `found ${files.length} source files`);
  const code = 'import postcss from "postcss";\nawait import("postcss");\n';
  for (const file of files)
    assert.equal(await restrictions(code, file), 2, file);
});
