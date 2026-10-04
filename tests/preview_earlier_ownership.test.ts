import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

for (const route of ["view/screens/home.html", "view/home/index.html"])
  test(`earlier preview marker cannot adopt ${route}`, async (t) => {
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    const output = path.join(fixture.root, ".context/earlier-preview");
    await fs.mkdir(path.dirname(path.join(output, route)), { recursive: true });
    const sample = await fs.readFile(
      path.join(
        repositoryRoot,
        "tests/fixtures/earlier-ownership/plain-mokly.html",
      ),
      "utf8",
    );
    await fs.writeFile(
      path.join(output, ".mokly-preview-artifact"),
      "schemaVersion=1\n",
    );
    await fs.writeFile(path.join(output, route), sample);
    const before = await directoryFiles(output);
    await assert.rejects(
      exportCatalogue(fixture.config, { outDir: output }),
      /ownership is missing/,
    );
    await assert.rejects(
      buildPreview(fixture.config, output),
      /unowned preview directory.*ownership is missing/,
    );
    assert.deepEqual(await directoryFiles(output), before);
  });
