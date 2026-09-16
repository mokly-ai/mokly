import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import { exportedDelivery } from "./helpers/export_delivery.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("export owns a deterministic public catalogue and stamps its artifact identity", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  const files = await directoryFiles(fixture.output);
  const bytes = files.get("__mokly/catalogue.json");
  assert.ok(bytes, "public read model is an owned artifact");
  const model = JSON.parse(bytes.toString());
  assert.equal(model.deploymentId, result.deploymentId);
  assert.equal(model.deploymentId, exportedDelivery(files).deploymentId);
  assert.equal(`/${model.comparisonUrl}`, result.comparisonUrl);
  assert.deepEqual(model.revision, { content: 0, evidence: 0 });
  const ownership = JSON.parse(files.get(".mokly-export-artifact")!.toString());
  assert.equal(ownership.schemaVersion, 1);
  assert.ok(ownership.files.includes("__mokly/catalogue.json"));
  await fs.rm(fixture.output, { recursive: true });
  await exportCatalogue(fixture.config, { outDir: "elsewhere" });
  assert.deepEqual(
    await fs.readFile(
      path.join(fixture.root, "elsewhere/__mokly/catalogue.json"),
    ),
    bytes,
  );
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  const current = JSON.parse(
    await fs.readFile(
      path.join(fixture.output, "__mokly/catalogue.json"),
      "utf8",
    ),
  );
  assert.equal(current.comparisonUrl, null);
  assert.equal(current.changesStatus, "disabled");
});
