import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import ts from "typescript";

import {
  auditContextSource,
  comparisonContextAudit,
} from "./helpers/comparison_context_audit.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("every component-aware comparison context in tests supplies production links", async () => {
  const root = path.resolve("tests");
  const files = (await fs.readdir(root, { recursive: true }))
    .filter(
      (file) =>
        /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(file) &&
        !file.split(path.sep).includes("node_modules"),
    )
    .map((file) => path.join(root, file));
  const program = ts.createProgram(files, {
    allowJs: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX,
  });
  const { contexts, failures } = comparisonContextAudit(program, root);
  assert.ok(contexts >= 10, "the context inventory must not be empty");
  assert.deepEqual(failures, []);
});

test("context audit covers direct, shorthand, spread and explicit oracle shapes", () => {
  const common = `const base = { beforeReader: {}, afterReader: {}, resources: {}, dependencies: {} };`;
  for (const expression of [
    `{ ...base, componentAware: true }`,
    `{ ...base, componentAware }`,
    `{ ...base, ...{ componentAware: true } }`,
    `{ ...base, componentAware: true, links: undefined }`,
    `{ ...base, componentAware: true, comparisonOracle: "other" as const }`,
  ]) {
    const audit = auditContextSource(
      `${common} const componentAware = true; const context = ${expression};`,
    );
    assert.equal(audit.contexts, 1, expression);
    assert.equal(audit.failures.length, 1, expression);
  }
  for (const expression of [
    `{ ...base, componentAware: false }`,
    `{ ...base, componentAware: true, links: () => ({}) }`,
    `{ ...base, componentAware: true, comparisonOracle: "page_m6" as const }`,
    `{ ...{ ...base, componentAware: true, links: () => ({}) } }`,
  ])
    assert.deepEqual(
      auditContextSource(`${common} const context = ${expression};`).failures,
      [],
      expression,
    );
});

test("comparison helpers require production links except the explicit M6 oracle", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const input = path.join(fixture.root, "comparison-context.json");
  await fs.writeFile(
    input,
    JSON.stringify({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: [...fixture.before.outputs],
      afterFiles: [...fixture.after.outputs],
      config: fixture.config,
      changedPaths: [],
    }),
  );
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    fileURLToPath(
      new URL("./helpers/comparison_context_probe.mjs", import.meta.url),
    ),
    input,
  ]);
  const counts = JSON.parse(stdout) as { production: number; oracle: number };
  assert.ok(counts.production > 0);
  assert.ok(counts.oracle > 0);
});
