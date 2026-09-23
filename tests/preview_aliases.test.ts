import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const preview = (root: string, output: string) =>
  execute(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { loadConfig } from "./dist/config/load.js"; import { buildPreview } from "./scripts/preview/catalogue.mjs"; await buildPreview(await loadConfig(process.argv[1]), process.argv[2]);',
      root,
      output,
    ],
    { cwd: repositoryRoot, timeout: 60_000 },
  );

for (const source of ["routed pages", "public documents"]) {
  test(`preview rejects colliding ${source} aliases before replacing an existing site`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const output = path.join(fixture.root, ".context/published");
    const build = () => preview(fixture.root, output);
    await build();
    const previous = await directoryFiles(output);
    if (source === "routed pages") {
      await fs.promises.writeFile(
        fixture.entryPath,
        (await fs.promises.readFile(fixture.entryPath, "utf8")).replace(
          'route: "screens/details.html"',
          'route: "screens/home/details.html"',
        ),
      );
    } else {
      await fs.promises.mkdir(path.join(fixture.mockupsDir, "guide"));
      await fs.promises.writeFile(
        path.join(fixture.mockupsDir, "guide.html"),
        "<h1>Guide</h1>",
      );
      await fs.promises.writeFile(
        path.join(fixture.mockupsDir, "guide/details.html"),
        "<h1>Details</h1>",
      );
    }
    await exportCatalogue(fixture.config, { outDir: "site" });
    const before = await directoryFiles(fixture.mockupsDir);
    await assert.rejects(build(), /Export file\/directory collision/);
    assert.deepEqual(await directoryFiles(fixture.mockupsDir), before);
    assert.deepEqual(await directoryFiles(output), previous);
    assert.deepEqual(
      await fs.promises.readdir(
        path.join(fixture.root, ".context/.mokly-export-reservations/locks"),
      ),
      [],
    );
  });
}

test("preview captures compiled output without restoring local generated files", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const compilation = await compileCatalogue(fixture.config);
  for (const route of compilation.outputs.keys())
    await fs.promises.rm(path.join(fixture.mockupsDir, route));
  const before = await directoryFiles(fixture.mockupsDir);
  const output = path.join(fixture.root, ".context/published");
  await preview(fixture.root, output);
  assert.deepEqual(await directoryFiles(fixture.mockupsDir), before);
  assert.match(
    await fs.promises.readFile(
      path.join(output, "static/screens/home.mobile.html"),
      "utf8",
    ),
    /id="home-mobile"/,
  );
});

test("preview serves compiled bytes instead of stale local generated output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const route = "screens/home.mobile.html";
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, route),
    "<!doctype html><html><body>Stale local output</body></html>",
  );
  const before = await directoryFiles(fixture.mockupsDir);
  const output = path.join(fixture.root, ".context/published");
  await preview(fixture.root, output);
  assert.deepEqual(await directoryFiles(fixture.mockupsDir), before);
  const published = await fs.promises.readFile(
    path.join(output, "static", route),
    "utf8",
  );
  assert.match(published, /id="home-mobile"/);
  assert.doesNotMatch(published, /Stale local output/);
});

test("adapter aliases cannot claim the final export ownership marker", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const previous = await directoryFiles(fixture.output);
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      adapter: {
        transform: () => new Map([[".mokly-export-artifact", "index.html"]]),
      },
    }),
    /collision|Invalid hosting alias/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), previous);
});
