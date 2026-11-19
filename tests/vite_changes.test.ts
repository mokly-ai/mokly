import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { viteChangesFixture, viteSnapshot } from "./fixtures/vite_changes.js";
import { reportDuration } from "./helpers/durations.js";
import { build } from "./helpers/static_changes.js";

test("Vite Changes compiles the extracted base with its own setup and the selected installation", async (context) => {
  await reportDuration(
    "Vite base Changes",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteChangesFixture(context);
      const result = await build(fixture.root);
      assert.ok(result.index.comparisonUrl, result.stderr);
      assert.equal(result.index.baseCommit, fixture.base);
      assert.deepEqual(
        result.index.screens.map(({ path, changes }) => ({ path, ...changes })),
        [{ path: "vite", status: "ready", included: true, kind: "changed" }],
      );
      const before = await fs.readFile(
        viteSnapshot(result.output, result.index.comparisonUrl, "before"),
        "utf8",
      );
      const after = await fs.readFile(
        viteSnapshot(result.output, result.index.comparisonUrl, "after"),
        "utf8",
      );
      assert.match(
        before,
        /base setup\|base env\|base source\|dependency\|configured\|modules=false/,
      );
      assert.match(
        after,
        /head setup\|head env\|head source\|dependency\|configured\|modules=true/,
      );
      assert.doesNotMatch(result.stderr, /base-dependencies/);
    },
  );
});
