import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  assert.equal(ownership.schemaVersion, 2);
  assert.deepEqual(Object.keys(ownership).sort(), ["files", "schemaVersion"]);
  assert.deepEqual(
    ownership.files.map(({ path: name }: { path: string }) => name),
    ownership.files.map(({ path: name }: { path: string }) => name).toSorted(),
  );
  for (const entry of ownership.files as Array<{
    path: string;
    sha256: string;
    size: number;
  }>) {
    assert.deepEqual(Object.keys(entry).sort(), ["path", "sha256", "size"]);
    const owned = files.get(entry.path);
    assert.ok(owned, entry.path);
    assert.equal(entry.size, owned.length, entry.path);
    assert.equal(
      entry.sha256,
      crypto.createHash("sha256").update(owned).digest("hex"),
      entry.path,
    );
  }
  assert.ok(
    ownership.files.some(
      ({ path: name }: { path: string }) => name === "__mokly/catalogue.json",
    ),
  );
  assert.ok(
    ownership.files.some(
      ({ path: name }: { path: string }) => name === "index.html",
    ),
  );
  await fs.rm(fixture.output, { recursive: true });
  const elsewhere = await exportCatalogue(fixture.config, {
    outDir: "elsewhere",
  });
  assert.equal(elsewhere.deploymentId, result.deploymentId);
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

test("adapter files enter the finalized ownership marker", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const upload = `${JSON.stringify({ schemaVersion: 1 })}\n`;
  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
    adapter: {
      transform(files) {
        files.set("mokly-upload.json", upload);
      },
    },
  });
  const files = await directoryFiles(fixture.output);
  const marker = JSON.parse(files.get(".mokly-export-artifact")!.toString());
  const entry = marker.files.find(
    ({ path: name }: { path: string }) => name === "mokly-upload.json",
  );
  assert.deepEqual(entry, {
    path: "mokly-upload.json",
    sha256: crypto.createHash("sha256").update(upload).digest("hex"),
    size: Buffer.byteLength(upload),
  });
});

test("an oversized export file fails before capture or replacement", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  const previous = await directoryFiles(fixture.output);
  let captured = false;
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges: true,
      adapter: {
        transform(files) {
          files.set("static/too-large.bin", Buffer.alloc(64 * 1024 * 1024 + 1));
        },
      },
      capture: async () => {
        captured = true;
      },
    }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "export-invalid" &&
      /64 MiB/.test(error.message),
  );
  assert.equal(captured, false);
  assert.deepEqual(await directoryFiles(fixture.output), previous);
});
