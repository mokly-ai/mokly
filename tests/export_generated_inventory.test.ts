import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { generatedHeader } from "../packages/mokly/dist/build/ownership.js";
import { capturePublicFiles } from "../packages/mokly/dist/export/public_files.js";
import { exportResourcePolicy } from "../packages/mokly/dist/export/resource_policy.js";

import { createExportFixture } from "./helpers/export_fixture.js";

// A generated set can relax name filtering only after source and metadata denial.
test("exact generated membership preserves source, metadata and exclusion boundaries", async (t) => {
  const fixture = await createExportFixture(undefined, {
    extraConfig: 'publicExclude: ["private/**"],',
  });
  t.after(() => fixture.close());
  const names = [
    "coverage/index.mobile.html",
    "mokly-manifest.json",
    "view.source.html",
    "private/index.html",
    "mokly-generated/metadata.json",
  ];
  const policy = exportResourcePolicy(fixture.config, false, new Set(names));
  assert.equal(policy(names[0]!), true);
  for (const name of names.slice(1)) assert.equal(policy(name), false, name);
});

test("an ownership header alone never grants export traversal through a private build directory", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await fs.mkdir(path.join(fixture.mockupsDir, "coverage"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "coverage/extra.html"),
    generatedHeader("entries/fixture.mockup.tsx") +
      "<html><body>Uninventoried</body></html>",
  );
  const files = await capturePublicFiles(fixture.config);
  assert.ok(!files.has("coverage/extra.html"));
});
