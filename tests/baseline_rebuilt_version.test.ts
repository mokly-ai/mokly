import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { exportCatalogue } from "../dist/export/run.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

test("the base's own root-level v7 rebuild stops preparation and exports current content", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.writeFile(
    path.join(fixture.root, "baseline.mjs"),
    `
import fs from "node:fs/promises";
await fs.rm("mockups/mokly-generated", { recursive: true, force: true });
await fs.mkdir("mockups", { recursive: true });
await fs.writeFile("mockups/mokly-manifest.json", JSON.stringify({ schemaVersion: 7 }));
`,
  );
  await fixture.git("add", "baseline.mjs");
  await fixture.git("commit", "-qm", "test: base writes root-level v7");
  const commit = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  await assert.rejects(prepareReviewRepository(fixture.config, "HEAD"), {
    code: "baseline-incompatible-earlier",
  });
  const lines: string[] = [];
  const result = await exportCatalogue(fixture.config, {
    base: "HEAD",
    outDir: "site",
    incompatibleBaseline: (rejected) => {
      assert.equal(rejected, "HEAD");
      lines.push(EARLIER_BASELINE_MESSAGE);
    },
  });
  assert.equal(result.comparisonUrl, null);
  const catalogue = JSON.parse(
    await fs.readFile(
      path.join(result.outDir, "mokly-viewer/catalogue.json"),
      "utf8",
    ),
  );
  assert.equal(catalogue.changesStatus, "unavailable");
  assert.equal(catalogue.comparisonUrl, null);
  assert.deepEqual(catalogue.removedEntries, []);
  assert.deepEqual(lines, [
    "Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.",
  ]);
  await assert.rejects(
    fs.stat(
      path.join(
        fixture.root,
        ".mokly-cache/baselines",
        commit,
        "complete.json",
      ),
    ),
    { code: "ENOENT" },
  );
});
