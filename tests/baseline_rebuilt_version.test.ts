import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { exportCatalogue } from "../dist/export/run.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { assertRebuiltEarlierNotice } from "./helpers/rebuilt_baseline_notice.js";

for (const baseline of ["root-level v7", "released v9"] as const) {
  test(`the base's own ${baseline} rebuild stops preparation and exports current content`, async (context) => {
    const fixture = await derivedFixture(context);
    if (baseline === "released v9")
      await fs.copyFile(
        new URL("./fixtures/released-manifest-v9.json", import.meta.url),
        path.join(fixture.root, "released-manifest.json"),
      );
    await fs.writeFile(
      path.join(fixture.root, "baseline.mjs"),
      `
import fs from "node:fs/promises";
await fs.rm("mockups/mokly-generated", { recursive: true, force: true });
${
  baseline === "released v9"
    ? `await fs.mkdir("mockups/mokly-generated", { recursive: true });
await fs.copyFile("released-manifest.json", "mockups/mokly-generated/mokly-manifest.json");`
    : `await fs.mkdir("mockups", { recursive: true });
await fs.writeFile("mockups/mokly-manifest.json", JSON.stringify({ schemaVersion: 7 }));`
}
`,
    );
    await fixture.git("add", ".");
    await fixture.git("commit", "-qm", `test: base writes ${baseline}`);
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
}

test("a base recipe can leave root-level v7 beside one moved v10 catalogue", async (t) => {
  const fixture = await derivedFixture(t);
  const recipe = path.join(fixture.root, "baseline.mjs");
  await fs.appendFile(
    recipe,
    `
await fs.rename("mockups", "historical");
await fs.mkdir("mockups");
await fs.writeFile("mockups/mokly-manifest.json", JSON.stringify({ schemaVersion: 7 }));
`,
  );
  await fixture.git("add", "baseline.mjs");
  await fixture.git("commit", "-qm", "test: current output and stale envelope");
  const prepared = await prepareReviewRepository(fixture.config, "HEAD");
  assert.equal(prepared.selection, "rebuild");
  assert.equal(prepared.descriptor.catalogueRoot, "historical");
  assert.equal(prepared.marker?.manifestVersion, 10);
  assert.equal(
    await prepared.reader.readFile(
      prepared.commit,
      "historical/mokly-generated/home/index.mobile.html",
    ),
    fixture.baseline.outputs.get("home/index.mobile.html"),
  );
});

test(
  "watched Serve retains earlier rebuild notices and never caches incompatible output",
  { timeout: 60_000 },
  async (t) => {
    await assertRebuiltEarlierNotice(t, true);
  },
);
