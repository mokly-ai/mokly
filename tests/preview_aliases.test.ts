import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

for (const source of ["public documents"]) {
  test(`preview rejects colliding ${source} aliases before replacing an existing site`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const output = path.join(fixture.root, ".context/published");
    const build = () =>
      execute(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          'import { loadConfig } from "./dist/config/load.js"; import { buildPreview } from "./scripts/preview/catalogue.mjs"; await buildPreview(await loadConfig(process.argv[1]), process.argv[2]);',
          fixture.root,
          output,
        ],
        { cwd: repositoryRoot, timeout: 60_000 },
      );
    await build();
    const previous = await directoryFiles(output);
    await fs.promises.mkdir(path.join(fixture.mockupsDir, "guide"));
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "guide.html"),
      "<h1>Guide</h1>",
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "guide/details.html"),
      "<h1>Details</h1>",
    );
    await exportCatalogue(fixture.config, { outDir: "site" });
    await assert.rejects(build(), /Export file\/directory collision/);
    assert.deepEqual(await directoryFiles(output), previous);
    assert.deepEqual(
      await fs.promises.readdir(
        path.join(fixture.root, ".context/.mokly-export-reservations/locks"),
      ),
      [],
    );
  });
}

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
