import assert from "node:assert/strict";
import test from "node:test";

import { catalogueAtBaseline } from "../dist/server/baseline_catalogue.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("removed screens and saved variants retain baseline context with null current paths", async (t) => {
  const source = componentEntrySource({
    body: '<action.Component label="Child" />',
  }).replace(
    'childIds: ["action", "pane"]',
    'childIds: ["home", "action", "pane"]',
  );
  const fixture = await componentReviewFixture(
    t,
    (value) =>
      value
        .slice(0, value.indexOf("  defineScreen("))
        .concat("];")
        .replace(
          'childIds: ["home", "action", "pane"]',
          'childIds: ["action", "pane"]',
        )
        .replace(
          ', { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
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
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  assert.deepEqual(model.removedEntries[0]?.ancestors, [
    { id: "components", title: "Components" },
  ]);
  const removed = model.removedEntries[0]!.entry;
  assert.equal(removed.kind, "screen");
  if (removed.kind !== "screen") throw new Error("Expected removed screen");
  for (const view of removed.views) {
    assert.equal(view.fragmentPath, null);
    assert.equal(view.usage.status, "ready");
    assert.deepEqual(view.comparison, {
      status: "ready",
      kind: "removed",
      eligible: false,
    });
  }
  const variant = model.components
    .find((item) => item.id === "action")!
    .variants.find((item) => item.id === "disabled")!;
  assert.deepEqual(variant.comparison, {
    status: "ready",
    kind: "removed",
    eligible: true,
  });
  assert.ok(variant.views.every((view) => view.fragmentPath === null));
  assert.deepEqual(readCatalogue(JSON.parse(serializeCatalogue(model))), model);
  const historical = structuredClone(fixture.before.manifest);
  for (const entry of historical.entries)
    if (entry.kind === "screen") delete entry.componentViews;
  const legacy = {
    schemaVersion: 3 as const,
    generatedBy: "mokly" as const,
    legacyPages: [],
    entries: historical.entries.filter(
      (entry) =>
        entry.kind !== "component" &&
        entry.kind !== "page" &&
        entry.kind !== "collection",
    ),
  };
  const unavailable = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: catalogueAtBaseline(fixture.after.manifest, legacy),
    changesStatus: "ready",
    evidence: { baseline: legacy },
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  const old = unavailable.removedEntries[0]!.entry;
  assert.ok(
    old.kind === "screen" &&
      old.views.every((view) => view.usage.status === "unavailable"),
  );
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
