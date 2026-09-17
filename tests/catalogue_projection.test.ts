import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("projection exposes real usage and attribution without private evidence", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace("{props.label}</button>", "Updated {props.label}</button>"),
  );
  const evidence = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );
  const input = {
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(fixture.after.manifest),
    changesStatus: "ready" as const,
    changedRoutes: evidence.changedRoutes,
    evidence,
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  };
  const model = projectCatalogue(input);
  const home = model.screens.find((screen) => screen.id === "home")!;
  assert.deepEqual(home.changes, {
    status: "ready",
    kind: "unmodified",
    included: false,
  });
  assert.deepEqual(home.views[0]?.comparison, {
    status: "ready",
    kind: "changed",
    eligible: true,
  });
  assert.deepEqual(
    model.components.find((entry) => entry.id === "action")?.changes,
    { status: "ready", kind: "changed", included: true },
  );
  assert.equal(home.views[0]?.usage.status, "ready");
  assert.deepEqual(
    home.views.map(({ viewport, colorScheme }) => `${viewport}/${colorScheme}`),
    ["mobile/light", "mobile/dark", "desktop/light", "desktop/dark"],
  );
  assert.equal(home.views[0]?.fragmentPath, "static/screens/home.mobile.html");
  const json = serializeCatalogue(model);
  for (const privateField of [
    "sourceFiles",
    "declaredDependencies",
    "ownedDependencies",
    "startOffset",
    "endOffset",
    "styles",
    "resources",
    "legacyPages",
    "headDigests",
    "changedPaths",
    "navPath",
  ])
    assert.equal(json.includes(`"${privateField}":`), false, privateField);
  assert.equal(json.includes(fixture.root), false);
  assert.deepEqual(readCatalogue(JSON.parse(json)), model);
  const reordered = projectCatalogue({
    ...input,
    catalogue: createCatalogue({
      ...fixture.after.manifest,
      entries: [...fixture.after.manifest.entries].reverse(),
    }),
  });
  assert.equal(serializeCatalogue(reordered), json);
  assert.equal(model.comparisonUrl, null);
  assert.equal(
    projectCatalogue({
      ...input,
      comparisonUrl: `__mokly/diffs/__generations/${"a".repeat(64)}/review.json`,
    }).comparisonUrl,
    `__mokly/diffs/__generations/${"a".repeat(64)}/review.json`,
  );
});

test("public v1 fixture conforms and compatible readers ignore additive fields", async () => {
  const json = await fs.readFile(
    "docs/protocol/fixtures/catalogue-v1.json",
    "utf8",
  );
  const fixture = JSON.parse(json);
  const model = readCatalogue(fixture);
  assert.equal(model.schemaVersion, 1);
  assert.equal(serializeCatalogue(model), json);
  fixture.future = { description: "An additive field" };
  fixture.screens[0].future = true;
  fixture.screens[0].views[0].usage.future = true;
  assert.deepEqual(readCatalogue(fixture), model);
  assert.throws(() => readCatalogue({ ...fixture, schemaVersion: 2 }));
  assert.throws(() =>
    readCatalogue({ schemaVersion: 5, generatedBy: "mokly", entries: [] }),
  );
});

test("reader rejects unsafe paths, private extensions and broken known references", async () => {
  const fixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  const mutations = [
    (value: typeof fixture) => {
      value.screens[0].details.sourcePath = "/private/entry.tsx";
    },
    (value: typeof fixture) => {
      value.screens[0].details.dependencies = ["C:/private/input.ts"];
    },
    (value: typeof fixture) => {
      value.screens[0].details.relatedDocs = ["../secret.md"];
    },
    (value: typeof fixture) => {
      value.screens[0].views[0].fragmentPath = "static/../secret.html";
    },
    (value: typeof fixture) => {
      value.screens[0].views[0].fragmentPath = "static/page.html?token=secret";
    },
    (value: typeof fixture) => {
      value.comparisonUrl = "__mokly/diffs/review.json";
    },
    (value: typeof fixture) => {
      value.sourceFiles = ["entries/source.tsx"];
    },
    (value: typeof fixture) => {
      value.extension = { styles: [{ startOffset: 2 }] };
    },
    (value: typeof fixture) => {
      value.tree.pages[0].id = "missing";
    },
    (value: typeof fixture) => {
      value.screens[0].useCaseIds = ["missing"];
    },
    (value: typeof fixture) => {
      value.revision.evidence = -1;
    },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(fixture);
    mutate(value);
    assert.throws(() => readCatalogue(value), String(mutate));
  }
});
