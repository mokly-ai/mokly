import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { EXPORT_MARKER } from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";

import { directoryFiles } from "./helpers/export_fixture.js";
import { createPreviewComparisonFixture } from "./helpers/preview_comparison_fixture.js";

test("export and preview reject an earlier marker without changing the destination", async (context) => {
  const fixture = await createPreviewComparisonFixture();
  context.after(() => fixture.close());
  await fs.promises.rm(path.join(fixture.output, EXPORT_MARKER));
  await fs.promises.writeFile(
    path.join(fixture.output, ".mokly-preview-artifact"),
    "schemaVersion=1\n",
  );
  const before = await directoryFiles(fixture.output);
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: fixture.output }),
    /ownership is missing/,
  );
  await assert.rejects(fixture.build, /unowned preview directory/);
  assert.deepEqual(await directoryFiles(fixture.output), before);
});
