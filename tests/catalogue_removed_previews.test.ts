import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { projectCatalogue } from "../dist/catalogue/projection.js";
import { serializeCatalogue } from "../dist/catalogue/serialization.js";
import { loadConfig } from "../dist/config/load.js";
import { catalogueAtBaseline } from "../dist/server/baseline_catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const generation = "c".repeat(64);
const comparisonUrl = `__mokly/diffs/__generations/${generation}/review.json`;

test("projection and reader retain typed removed page and screen previews", async (t) => {
  const model = await previewModel(t);
  assert.equal(model.comparisonUrl, comparisonUrl);
  assert.deepEqual(
    model.removedEntries.map(({ entry, preview }) => [
      entry.kind,
      entry.id,
      preview,
    ]),
    [
      ["page", "guide", { kind: "page" }],
      ["screen", "old", { kind: "screen" }],
    ],
  );
  const page = model.removedEntries[0]!.entry;
  const screen = model.removedEntries[1]!.entry;
  assert.ok(page.kind === "page" && !("documentPath" in page));
  assert.ok(
    screen.kind === "screen" &&
      screen.views.every((view) => !("fragmentPath" in view)),
  );
  assert.deepEqual(readCatalogue(JSON.parse(serializeCatalogue(model))), model);
});

test("reader tolerates old catalogues without preview descriptors", async (t) => {
  const value = JSON.parse(serializeCatalogue(await previewModel(t)));
  for (const removed of value.removedEntries) delete removed.preview;
  const model = readCatalogue(value);
  assert.ok(model.removedEntries.every((removed) => !removed.preview));
});

test("reader rejects malformed or incoherent removed preview descriptors", async (t) => {
  const original = JSON.parse(serializeCatalogue(await previewModel(t)));
  const mutations: ((value: typeof original) => void)[] = [
    (value) => {
      value.removedEntries[0].preview.kind = "future";
    },
    (value) => {
      value.removedEntries[0].preview.path = "../private.json";
    },
    (value) => {
      value.removedEntries[0].preview.path = `__mokly/diffs/__generations/${generation}/pages/archive/other.html.json`;
    },
    (value) => {
      value.removedEntries[0].preview.path = `__mokly/diffs/__generations/${"d".repeat(64)}/pages/archive/guide.html.json`;
    },
    (value) => {
      value.removedEntries[0].preview = { kind: "screen" };
    },
    (value) => {
      value.removedEntries[1].preview = { kind: "page" };
    },
    (value) => {
      value.removedEntries[1].preview.path = "unexpected.json";
    },
    (value) => {
      value.comparisonUrl = null;
    },
    (value) => {
      value.screens[0].preview = { kind: "screen" };
    },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(original);
    mutate(value);
    assert.throws(() => readCatalogue(value), String(mutate));
  }
});

test("projection requires descriptors to match a published comparison generation", async (t) => {
  const input = await previewInput(t);
  assert.throws(() =>
    projectCatalogue({
      ...input,
      comparisonUrl: null,
    }),
  );
  assert.throws(() =>
    projectCatalogue({
      ...input,
      removedPreviews: new Map([["other-page", { kind: "page" as const }]]),
    }),
  );
});

async function previewModel(t: test.TestContext) {
  return projectCatalogue(await previewInput(t));
}

async function previewInput(t: test.TestContext) {
  const fixture = await createFixture(source());
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  const current = {
    ...before.manifest,
    entries: before.manifest.entries.filter((entry) => entry.id === "current"),
  };
  return {
    configPath: "mokly.config.ts",
    catalogue: catalogueAtBaseline(current, before.manifest),
    changesStatus: "ready" as const,
    changedIds: ["guide", "old"],
    comparisonUrl,
    removedPreviews: new Map([
      ["guide", { kind: "page" as const }],
      ["old", { kind: "screen" as const }],
    ]),
    revision: { content: 0, evidence: 0 },
  };
}

function source(): string {
  return `import React from "react";
import { definePage, defineScreen } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [], description: "Fixture" };
export const mockups = [
  defineScreen({ ...metadata, id: "current", title: "Current", mobile: <p>Current</p>, desktop: <p>Current</p>, useCaseIds: [] }),
  defineScreen({ ...metadata, id: "old", title: "Old", mobile: <p>Old</p>, desktop: <p>Old</p>, useCaseIds: [] }),
  definePage({ ...metadata, id: "guide", title: "Guide", render: () => "<!doctype html><html><body>Guide</body></html>" })
];`;
}
