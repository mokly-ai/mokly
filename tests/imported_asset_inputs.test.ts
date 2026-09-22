import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { assertFreshSourceInventory } from "../dist/build/source_freshness.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { isPublicStaticFile } from "../dist/config/public_files.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const loader of ["dataurl", "base64", "binary", "file", "text"]) {
  test(`imported ${loader} asset bytes are protected rebuild inputs`, async (context) => {
    const fixture = await createFixture(undefined, {
      extraConfig: `moduleResolution: { loaders: { ".svg": "${loader}" } },`,
    });
    context.after(() => removeFixture(fixture));
    const asset = path.join(fixture.mockupsDir, "image.svg");
    await fs.writeFile(asset, "<svg/>");
    await fs.appendFile(
      fixture.entryPath,
      '\nimport image from "../mockups/image.svg"; mockups[1].title = String(image);',
    );
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    assert.ok(compilation.manifest.sourceFiles.includes("mockups/image.svg"));
    assert.equal(
      classifyWatchPath({ path: asset, kind: "change" }, config),
      "rebuild",
    );
    assert.equal(isPublicStaticFile(asset, config), false);
    const stale = {
      ...compilation.manifest,
      sourceFiles: compilation.manifest.sourceFiles.filter(
        (file) => file !== "mockups/image.svg",
      ),
    };
    await assert.rejects(
      assertFreshSourceInventory(config, stale),
      /source inventory is stale/,
    );
    await fs.writeFile(asset, '<svg width="200"><rect width="20"/></svg>');
    const rebuilt = await compileCatalogue(config);
    assert.notEqual(
      rebuilt.manifest.entries.find((entry) => entry.id === "home")?.title,
      compilation.manifest.entries.find((entry) => entry.id === "home")?.title,
    );
  });
}

test("an imported asset alias outside repoRoot is rejected before rendering", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'moduleResolution: { loaders: { ".svg": "dataurl" } },',
  });
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  await fs.writeFile(path.join(outside.root, "image.svg"), "<svg/>");
  await fs.symlink(
    path.join(outside.root, "image.svg"),
    path.join(fixture.mockupsDir, "image.svg"),
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport image from "../mockups/image.svg"; mockups[1].title = image;',
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /authoring input must be a regular file inside repoRoot/,
  );
});
