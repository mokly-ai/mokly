import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import ts from "typescript";

for (const scenario of ["view", "embedded", "once"])
  test(`creation provenance is validated outside selector matching: ${scenario}`, async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      fileURLToPath(
        new URL("./helpers/page_provenance_probe.mjs", import.meta.url),
      ),
      scenario,
    ]);
    assert.equal(JSON.parse(stdout).scenario, scenario);
  });

test("the attribute-span lookup depends only on attribute identity", async () => {
  const source = ts.createSourceFile(
    "page_reference_records.ts",
    await fs.readFile("src/review/page_reference_records.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "span" &&
      node.initializer &&
      ts.isConditionalExpression(node.initializer)
    ) {
      const selected = node.initializer.whenTrue;
      assert.ok(ts.isConditionalExpression(selected));
      assert.equal(selected.condition.getText(source), "attribute");
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(found);
});

test("matching contracts describe the conditional subject rule and adopted original-tree attributes", async () => {
  const contract = await fs.readFile(
    "docs/protocol/mokly-page-analysis.md",
    "utf8",
  );
  assert.match(
    contract,
    /with located descendant elements[\s\S]*suppressed exactly when every located descendant[\s\S]*otherwise they take the ignore status/,
  );
  assert.match(
    contract,
    /adopted root attributes[\s\S]*start tag inside paired ignored content/,
  );
  const provenance = await fs.readFile(
    "docs/protocol/mokly-page-source-provenance.md",
    "utf8",
  );
  assert.match(
    provenance,
    /\[original-page matching\]\([^)]*\) owns their status/,
  );
});
