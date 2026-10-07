import assert from "node:assert/strict";
import test from "node:test";

import { catalogueAtBaseline } from "../dist/server/baseline_catalogue.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

const previewGeneration = "d".repeat(64);

test("removed screens and saved variants retain baseline context with null current paths", async (t) => {
  const source = componentEntrySource({
    body: '<action.Component label="Child" />',
  }).replace(
    'path: "home", title: "Home",',
    'path: "components/home", title: "Home",',
  );
  const fixture = await componentReviewFixture(
    t,
    (value) =>
      value
        .slice(0, value.indexOf("  defineScreen("))
        .concat("];")
        .replace(
          ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
          "",
        ),
    source,
  );
  const evidence = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: catalogueAtBaseline(
      fixture.after.manifest,
      fixture.before.manifest,
    ),
    changesStatus: "ready",
    evidence,
    comparisonUrl: `mokly-viewer/diffs/generations/${previewGeneration}/review.json`,
    removedPreviews: new Map([
      ["components/home", { kind: "screen" as const }],
    ]),
    revision: { content: 0, evidence: 0 },
  });
  const removedRecord = model.removedEntries.find(
    ({ entry }) => entry.path === "components/home",
  )!;
  assert.deepEqual(removedRecord.folderTitles, ["Components"]);
  const removed = removedRecord.entry;
  assert.deepEqual(removedRecord.preview, { kind: "screen" });
  assert.equal(removed.kind, "screen");
  if (removed.kind !== "screen") throw new Error("Expected removed screen");
  for (const view of removed.views) {
    assert.equal("fragmentPath" in view, false);
    assert.equal(view.usage.status, "ready");
    assert.deepEqual(view.comparison, {
      status: "ready",
      kind: "removed",
      eligible: false,
    });
  }
  const variant = model.removedEntries.find(
    ({ entry }) => entry.path === "action/disabled",
  )!.entry;
  assert.equal(variant.kind, "component");
  if (variant.kind !== "component" || !("variantOf" in variant))
    throw new Error("Expected removed component variant");
  assert.deepEqual(variant.comparison, {
    status: "ready",
    kind: "removed",
    eligible: true,
  });
  assert.ok(variant.views.every((view) => !("fragmentPath" in view)));
  assert.deepEqual(readCatalogue(JSON.parse(serializeCatalogue(model))), model);
});

test("removed parents precede authored variants and the next sorted entry", async (t) => {
  const source = componentEntrySource({ body: "<p>Before</p>" })
    .replace('slug: "default"', 'slug: "zulu"')
    .replace('slug: "disabled"', 'slug: "alpha"')
    .replace('path: "pane"', 'path: "action-middle"');
  const fixture = await componentReviewFixture(
    t,
    () => componentEntrySource({ body: "<p>After</p>", exports: "" }),
    source,
  );
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: catalogueAtBaseline(
      fixture.after.manifest,
      fixture.before.manifest,
    ),
    changesStatus: "ready",
    evidence: { baseline: fixture.before.manifest },
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });

  const removedPaths = model.removedEntries.map(({ entry }) => entry.path);
  assert.deepEqual(removedPaths, [
    "action",
    "action/zulu",
    "action/alpha",
    "action-middle",
    "action-middle/default",
  ]);
  assert.deepEqual(readCatalogue(JSON.parse(serializeCatalogue(model))), model);
});

test("historical usage survives changed component schemas and slot declarations", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source
      .slice(0, source.indexOf("  defineScreen("))
      .concat("];")
      .replaceAll("children", "content")
      .replace(
        'label: { schema: { kind: "string" } }',
        'label: { schema: { kind: "number" } }',
      )
      .replace('{ kind: "text", maxLength: 80 }', '{ kind: "number" }')
      .replaceAll('label: "Continue"', "label: 1")
      .replace('label="Inside"', "label={1}"),
  );
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: catalogueAtBaseline(
      fixture.after.manifest,
      fixture.before.manifest,
    ),
    changesStatus: "ready",
    evidence: { baseline: fixture.before.manifest },
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  const json = serializeCatalogue(model);
  assert.deepEqual(readCatalogue(JSON.parse(json)), model);
  const malformed = JSON.parse(json);
  malformed.removedEntries[0].entry.views[0].usage.slots[0].instanceKey =
    "e".repeat(64);
  assert.throws(
    () => readCatalogue(malformed),
    "historical usage still validates ownership references",
  );
});
