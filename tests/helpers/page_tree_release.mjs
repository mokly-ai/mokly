import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import { classifyComponents } from "../../src/review/component_classification.ts";
import { CssResourceAnalysis } from "../../src/review/css/resource_analysis.ts";
import { PageAnalysis } from "../../src/review/page_analysis.ts";

import { compilationFiles, memoryReader } from "./component_fast_path.ts";
import { componentEntrySource } from "./component_fixture.ts";
import { createFixture, removeFixture } from "./fixture.ts";

assert.equal(typeof global.gc, "function");
const fixture = await createFixture(componentEntrySource(), {
  extraConfig: 'stylesheets: [{match: "**", stylesheets: ["action.css"]}],',
});
try {
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    "button{color:red}",
  );
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    "button{color:blue}",
  );
  const after = await compileCatalogue(config);
  const references = [];
  const original = PageAnalysis.prototype.matching;
  PageAnalysis.prototype.matching = function (paired) {
    const tree = original.call(this, paired);
    references.push(new WeakRef(tree));
    return tree;
  };
  const cssAnalysis = new CssResourceAnalysis();
  let result;
  try {
    result = await classifyComponents({
      before: before.manifest,
      after: after.manifest,
      beforeReader: memoryReader(
        compilationFiles(before, { "action.css": "button{color:red}" }),
      ),
      afterReader: memoryReader(
        compilationFiles(after, { "action.css": "button{color:blue}" }),
      ),
      config,
      changedPaths: ["mockups/action.css"],
      baseCommit: "a".repeat(40),
      baseRef: "main",
      cssAnalysis,
    });
  } finally {
    PageAnalysis.prototype.matching = original;
  }
  assert.ok(result.changes.length > 0);
  assert.ok(references.length > 0);
  for (let round = 0; round < 12; round++) {
    await setImmediate();
    global.gc();
  }
  assert.equal(
    references.filter((reference) => reference.deref()).length,
    0,
    "finished view trees must not survive in the retained CSS analysis",
  );
  // Keep both classifier products alive through the collection check.
  assert.ok(result.changes.length > 0);
  assert.ok(cssAnalysis.attribution);
  process.stdout.write(
    JSON.stringify({ trees: references.length, retained: 0 }) + "\n",
  );
} finally {
  await removeFixture(fixture);
}
