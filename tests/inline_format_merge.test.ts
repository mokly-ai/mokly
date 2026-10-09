import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseManifest, serializeManifest } from "../dist/registry/manifest.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { ReviewResultV7 } from "../packages/viewer/src/review/component_types.js";
import { projectCatalogue } from "../src/catalogue/projection.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("manifest v10 has resource and inserted-link records without styles", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(manifest.schemaVersion, 10);
  const entries = manifest.entries.filter((entry) => "componentViews" in entry);
  assert.ok(entries.length);
  for (const entry of entries)
    for (const view of entry.componentViews ?? []) {
      assert.equal(Object.hasOwn(view, "styles"), false);
      assert.ok(Array.isArray(view.resources));
      assert.ok(Array.isArray(view.insertedStylesheets));
      if (entry.kind === "component")
        assert.equal(
          view.ranges.filter((range) => range.target.kind === "root").length,
          1,
        );
    }
  assert.deepEqual(
    parseManifest(JSON.parse(serializeManifest(manifest))),
    manifest,
  );
});

for (const inlineStyles of [
  { status: "matched", selectors: ["main"] },
  { status: "unresolved", selectors: [] },
  { status: "excluded" },
] as const)
  test(`catalogue v6 round-trips ${inlineStyles.status} inline evidence`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
    const address = { path: "home", title: "Home" };
    const changed = inlineStyles.status !== "excluded";
    const result: ReviewResultV7 = {
      schemaVersion: 7,
      baseCommit: "a".repeat(40),
      baseRef: "main",
      changedPaths: [],
      ignoredImpact: [],
      affectedConsumers: [],
      components: [],
      changes: changed
        ? [
            {
              kind: "screen",
              before: address,
              after: address,
              reasons: [{ kind: "material" }],
            },
          ]
        : [],
      screens: [
        {
          ...address,
          before: address,
          after: address,
          state: changed ? "changed" : "unchanged",
          views: [
            {
              viewport: "mobile",
              colorScheme: "light",
              state: changed ? "changed" : "unchanged",
              ignoredIds: [],
              inlineStyles,
              ...(changed ? { material: true as const } : {}),
            },
          ],
        },
      ],
    };
    const model = projectCatalogue({
      configPath: "mokly.config.ts",
      catalogue: createCatalogue(manifest),
      changesStatus: "ready",
      comparison: result,
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
    });
    assert.equal(model.schemaVersion, 6);
    assert.deepEqual(
      model.screens.find((entry) => entry.path === "home")!.views[0]!
        .resourceEvidence,
      { inlineStyles },
    );
    assert.deepEqual(readCatalogue(model), model);
  });
