import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { assembleExport } from "../dist/export/site.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const producer of ["live", "export"])
  test(`${producer} omits empty resource views and screens`, async (t) => {
    const fixture = await cssAttributionFixture(t, false, {
      prepare: async ({ configPath, entryPath }) => {
        await fs.writeFile(
          configPath,
          (await fs.readFile(configPath, "utf8")).replace(
            'stylesheets: [{ match: "**/*.html", stylesheets: ["shared.css"] }]',
            "stylesheets: []",
          ),
        );
        await fs.writeFile(
          entryPath,
          (await fs.readFile(entryPath, "utf8")).replace(
            '<main id="home-mobile">',
            '<main id="home-mobile"><link rel="stylesheet" href="../shared.css" />',
          ),
        );
      },
    });
    await fixture.append(".auth { padding: 2px; }");
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    );
    if (producer === "live") {
      assert.deepEqual(
        changes.componentChanges?.screenEvidence?.map(({ route, views }) => ({
          route,
          views: views.map((view) => view.viewport),
        })),
        [{ route: "screens/home.html", views: ["mobile", "mobile"] }],
      );
      return;
    }
    const comparison = await fixture.compare();
    const site = assembleExport(
      fixture.config,
      await compileCatalogue(fixture.config),
      changes.componentChanges!.baseline,
      comparison,
      await capturePublicFiles(fixture.config),
      [],
    );
    for (const screen of comparison.result.screens) {
      const html = String(site.inventory.files.get(`view/${screen.route}`));
      const json = /<script[^>]*data-workspace-data[^>]*>(.*?)<\/script>/s.exec(
        html,
      )?.[1];
      assert.ok(json);
      const data = JSON.parse(json) as WorkspaceData;
      assert.deepEqual(
        data.resourceEvidence?.map((view) => view.viewport),
        screen.id === "home" ? ["mobile", "mobile"] : undefined,
      );
    }
  });
