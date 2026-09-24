import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { ExportInventory } from "../dist/export/inventory.js";
import { assertExportOwnership } from "../dist/export/ownership.js";
import { resolveExportOutput } from "../dist/export/paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("export confines output before any write and resolves against config", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.equal(
    resolveExportOutput(config, "site"),
    path.join(fixture.root, "site"),
  );
  for (const output of [
    "",
    ".",
    "..",
    "entries",
    "mockups",
    ".review",
    "node_modules/site",
    ".git/site",
    ".mokly-export-reservations/site",
  ])
    assert.throws(() => resolveExportOutput(config, output));
  assert.equal(fs.existsSync(path.join(fixture.root, "site")), false);
  await fs.promises.symlink(
    fixture.mockupsDir,
    path.join(fixture.root, "alias"),
  );
  assert.throws(() => resolveExportOutput(config, "alias/.generated/nested"));
  await fs.promises.symlink(
    path.dirname(fixture.root),
    path.join(fixture.root, "outside"),
  );
  assert.throws(() => resolveExportOutput(config, "outside/nested"));
});

test("export refuses unowned, malformed, and mixed output", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await assertExportOwnership(output);
  await fs.promises.mkdir(output);
  await assertExportOwnership(output);
  await fs.promises.writeFile(path.join(output, "keep.txt"), "user-owned");
  await assert.rejects(assertExportOwnership(output), /ownership/);
  const marker = path.join(output, ".mokly-export-artifact");
  for (const content of [
    "{}",
    '{"schemaVersion":2,"files":[]}',
    '{"schemaVersion":1,"files":["../keep.txt"]}',
  ]) {
    await fs.promises.writeFile(marker, content);
    await assert.rejects(assertExportOwnership(output), /ownership/);
  }
  await fs.promises.writeFile(
    marker,
    JSON.stringify({ schemaVersion: 1, files: ["index.html"] }),
  );
  await assert.rejects(assertExportOwnership(output), /unowned/);
  assert.equal(
    await fs.promises.readFile(path.join(output, "keep.txt"), "utf8"),
    "user-owned",
  );
});

test("one inventory rejects path traversal and file/directory collisions", () => {
  const files = new ExportInventory();
  files.add("view/home.html", "Home");
  files.add("view/home.html", "Home");
  for (const name of [
    "../index.html",
    "/index.html",
    "view",
    "view/home.html/child",
  ])
    assert.throws(() => files.add(name, "unsafe"));
  assert.throws(() => files.add("view/home.html", "Different"));
});
