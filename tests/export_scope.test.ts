import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveExportOutput } from "../packages/mokly/dist/export/paths.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { buildPreviewFixture } from "./helpers/preview_fixture.js";

test("preview rejects an ancestor symlink escaping its scratch root before writing", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const root = path.join(fixture.root, ".context");
  const elsewhere = path.join(fixture.root, "elsewhere");
  await fs.mkdir(root);
  await fs.mkdir(elsewhere);
  await fs.symlink(elsewhere, path.join(root, "link"));
  const output = path.join(root, "link/site");
  await assert.rejects(
    buildPreviewFixture(fixture.root, output),
    /root|inside|confined/,
  );
  assert.deepEqual(await fs.readdir(elsewhere), []);
});

test("adapter output roots constrain both lexical and projected real paths", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const root = path.join(fixture.root, ".context");
  const elsewhere = path.join(fixture.root, "elsewhere");
  await fs.mkdir(root);
  await fs.mkdir(elsewhere);
  await fs.symlink(elsewhere, path.join(root, "outward"));
  await fs.symlink(root, path.join(elsewhere, "inward"));
  for (const output of [
    path.join(root, "outward/site"),
    path.join(elsewhere, "inward/site"),
  ])
    assert.throws(
      () => resolveExportOutput(fixture.config, output, root),
      /root|inside|confined/,
    );
});

test("preview supports a confined symlinked scratch root and inner alias", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const physical = path.join(fixture.root, "scratch");
  const root = path.join(fixture.root, ".context");
  await fs.mkdir(physical);
  await fs.mkdir(path.join(physical, "storage"));
  await fs.symlink(physical, root);
  await fs.symlink(path.join(physical, "storage"), path.join(root, "link"));
  await buildPreviewFixture(fixture.root, path.join(root, "link/site"));
  const files = await directoryFiles(path.join(physical, "storage/site"));
  assert.ok(files.has("index.html"));
});

test("retargeting a preview ancestor during generation cannot redirect installation", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(
    path.join(fixture.root, ".gitignore"),
    ".context/\nelsewhere/\n",
  );
  const root = path.join(fixture.root, ".context");
  const original = path.join(root, "storage");
  const elsewhere = path.join(fixture.root, "elsewhere");
  await fs.mkdir(original, { recursive: true });
  await fs.mkdir(elsewhere);
  const alias = path.join(root, "link");
  await fs.symlink(original, alias);
  const output = path.join(alias, "site");
  await buildPreviewFixture(fixture.root, output);
  const previous = await directoryFiles(path.join(original, "site"));
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: output,
      adapter: {
        outputRoot: root,
        transform: async () => {
          await fs.unlink(alias);
          await fs.symlink(elsewhere, alias);
        },
      },
    }),
    /root|location|inside|confined/,
  );
  assert.deepEqual(await directoryFiles(path.join(original, "site")), previous);
  assert.deepEqual(await fs.readdir(elsewhere), []);
});
