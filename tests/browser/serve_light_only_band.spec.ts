/**
 * A current light-only document in Serve. A watched configuration edit drops
 * Dark from the catalogue. The removed entries keep their dark renders from
 * the base, so the shell still offers Dark, while the current Terms document
 * has a light page only. Under Dark a quiet band above the pane names it.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expectLightOnlyDocumentBand } from "./light_only_band.js";
import { test } from "./serve_comparison_test.js";

for (const width of [1280, 390])
  test(`${width}px: a current light-only document names its light page in a band under Dark`, async ({
    page,
    changes,
  }) => {
    const terms = changes.paths.currentDocument;
    const config = JSON.parse(
      await fs.readFile(path.join(changes.root, "mokly.config.json"), "utf8"),
    ) as object;
    await changes.edit(
      "mokly.config.json",
      JSON.stringify({ ...config, colorSchemes: ["light"] }),
      (index) =>
        index.documents
          .find((entry) => entry.path === terms)
          ?.colorSchemes.join() === "light",
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${terms}/`);
    await expectLightOnlyDocumentBand(page, terms, width);
  });
