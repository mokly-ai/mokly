import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { ReviewResultV7 } from "../packages/viewer/src/review/component_types.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { screenResultEvidence } from "../src/server/screen_view_changes.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Serve and export screen evidence keep mixed and inline-only view payloads", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
  const address = { path: "home", title: "Home" };
  const inlineStyles = { status: "excluded" as const };
  const excludedResources = [
    { path: "mockups/sheet.css", reason: "no-matching-rule" as const },
  ];
  const result: ReviewResultV7 = {
    schemaVersion: 7,
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["mockups/sheet.css"],
    ignoredImpact: [],
    affectedConsumers: [],
    changes: [],
    components: [],
    screens: [
      {
        ...address,
        before: address,
        after: address,
        state: "unchanged",
        views: [
          {
            viewport: "mobile",
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            inlineStyles,
            excludedResources,
          },
          {
            viewport: "desktop",
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            inlineStyles,
          },
        ],
      },
    ],
  };
  const screen = screenResultEvidence(result);
  assert.deepEqual(screen.screenEvidence, [
    {
      path: "home",
      views: [
        {
          viewport: "mobile",
          colorScheme: "light",
          inlineStyles,
          excludedResources,
        },
        { viewport: "desktop", colorScheme: "light", inlineStyles },
      ],
    },
  ]);
  for (const delivery of ["Serve", "export"] as const) {
    const evidence = {
      baseline: manifest,
      result,
      changedEntries: [],
      comparison: {
        baseRef: "main",
        baseCommit: result.baseCommit,
        changedPaths: [],
        headDigests: {},
      },
      ...screen,
    };
    const model = projectCatalogue({
      configPath: "mokly.config.ts",
      catalogue: createCatalogue(manifest),
      changesStatus: "ready",
      evidence,
      ...(delivery === "export" ? { comparison: result } : {}),
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
    });
    assert.deepEqual(
      model.screens
        .find((entry) => entry.path === "home")!
        .views.map((view) => view.resourceEvidence),
      [{ inlineStyles, excludedResources }, { inlineStyles }],
      delivery,
    );
    assert.deepEqual(readCatalogue(model), model);
  }
});
