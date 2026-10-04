import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { EXPORT_MARKER } from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";

import { directoryFiles } from "./helpers/export_fixture.js";
import { createPreviewComparisonFixture } from "./helpers/preview_comparison_fixture.js";

test("consumer export and repository preview reject earlier ownership without mutation", async (context) => {
  const fixture = await createPreviewComparisonFixture();
  context.after(() => fixture.close());
  await fs.promises.rm(path.join(fixture.output, EXPORT_MARKER));
  await fs.promises.rm(path.join(fixture.output, "__mokly/catalogue.json"));
  const legacy = await directoryFiles(fixture.output);
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: fixture.output }),
    /ownership is missing/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), legacy);
  await fixture.git("update-ref", "-d", "refs/remotes/origin/main");
  await assert.rejects(
    fixture.build,
    /unowned preview directory.*ownership is missing/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), legacy);
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await assert.rejects(
    fixture.build,
    /unowned preview directory.*ownership is missing/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), legacy);
  await fs.promises.writeFile(
    path.join(fixture.output, ".mokly-preview-artifact"),
    "invalid\n",
  );
  const invalid = await directoryFiles(fixture.output);
  await assert.rejects(fixture.build, /unowned preview directory/);
  assert.deepEqual(await directoryFiles(fixture.output), invalid);
});
