import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

const fixtureHelpers = new Set(["changedFixture", "componentReviewFixture"]);

test("fixture teardown drains dependents before removing their workspace", async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  const closed: string[] = [];
  fixture.beforeRemove(async () => {
    await fs.access(fixture.root);
    closed.push("outer");
  });
  fixture.beforeRemove(async () => {
    await fs.access(fixture.root);
    closed.push("inner");
  });

  await Promise.all([removeFixture(fixture), removeFixture(fixture)]);

  assert.deepEqual(closed, ["inner", "outer"]);
  await assert.rejects(fs.access(fixture.root), { code: "ENOENT" });
});

test("fixture teardown retains the workspace when a dependent cannot close", async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  fixture.beforeRemove(() => {
    throw new Error("dependent stayed open");
  });

  await assert.rejects(removeFixture(fixture), /dependent stayed open/);

  await fs.access(fixture.root);
});

test("fixture helper consumers do not register later teardown hooks", async () => {
  const testsRoot = path.join(repositoryRoot, "tests");
  const entries = await fs.readdir(testsRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const violations: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const filename = path.join(entry.parentPath, entry.name);
    const source = ts.createSourceFile(
      filename,
      await fs.readFile(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    inspectScope(source, source, violations);
  }
  assert.deepEqual(
    violations,
    [],
    "register dependent cleanup with fixture.beforeRemove(), not a later test hook",
  );
});

function inspectScope(
  source: ts.SourceFile,
  scope: ts.Node,
  violations: string[],
): void {
  const fixtures: number[] = [];
  const teardownHooks: ts.CallExpression[] = [];
  function inspect(node: ts.Node): void {
    if (node !== scope && isFunctionScope(node)) {
      inspectScope(source, node, violations);
      return;
    }
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        fixtureHelpers.has(node.expression.text)
      )
        fixtures.push(node.getStart(source));
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "after"
      )
        teardownHooks.push(node);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(scope);
  if (fixtures.length === 0) return;
  const firstFixture = Math.min(...fixtures);
  for (const hook of teardownHooks) {
    if (hook.getStart(source) < firstFixture) continue;
    const location = source.getLineAndCharacterOfPosition(
      hook.getStart(source),
    );
    violations.push(
      `${path.relative(repositoryRoot, source.fileName)}:${location.line + 1}`,
    );
  }
}

function isFunctionScope(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isMethodDeclaration(node)
  );
}
