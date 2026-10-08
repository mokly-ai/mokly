import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { readCatalogueChanges } from "../dist/server/component_changes.js";
import type { CatalogueNode } from "../packages/viewer/dist/catalogue/types.js";
import type { ManifestV9 } from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";

import { entryAt } from "./helpers/catalogue_selection.js";
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
    changedEntries: evidence.changedEntries,
    evidence,
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  };
  const model = projectCatalogue(input);
  const home = model.screens.find((screen) => screen.path === "home")!;
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
    model.components.find((entry) => entry.path === "action")?.changes,
    { status: "ready", kind: "changed", included: true },
  );
  assert.equal(home.views[0]?.usage.status, "ready");
  assert.deepEqual(
    home.views.map(({ viewport, colorScheme }) => `${viewport}/${colorScheme}`),
    ["mobile/light", "mobile/dark", "desktop/light", "desktop/dark"],
  );
  assert.equal("fragmentPath" in home.views[0]!, false);
  const json = serializeCatalogue(model);
  for (const privateField of [
    "sourceFiles",
    "declaredDependencies",
    "ownedDependencies",
    "startOffset",
    "endOffset",
    "styles",
    "resources",
    "headDigests",
    "changedPaths",
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
  assert.deepEqual(
    reordered.components
      .filter((entry) => "variantOf" in entry)
      .map((entry) => entry.path),
    ["action/disabled", "action/default", "pane/default"],
  );
  assert.equal(model.comparisonUrl, null);
  assert.equal(
    projectCatalogue({
      ...input,
      comparisonUrl: `mokly-viewer/diffs/generations/${"a".repeat(64)}/review.json`,
    }).comparisonUrl,
    `mokly-viewer/diffs/generations/${"a".repeat(64)}/review.json`,
  );
});

test("projection exposes screen variants beneath their parent entry", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const parent = fixture.after.manifest.entries.find(
    (entry): entry is CurrentManifestScreen => entry.kind === "screen",
  );
  assert.ok(parent);
  const zetaId = `${parent.path}/zeta`;
  const zeta: CurrentManifestScreen = {
    ...structuredClone(parent),
    description: "Zeta workspace",
    path: zetaId,
    title: `${parent.title}, zeta`,
    useCasePaths: [],
    variantOf: parent.path,
  };
  const alphaId = `${parent.path}/alpha`;
  const alpha: CurrentManifestScreen = {
    ...structuredClone(zeta),
    description: "Alpha workspace",
    path: alphaId,
    title: `${parent.title}, alpha`,
  };
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: createCatalogue({
      ...fixture.after.manifest,
      entries: [...fixture.after.manifest.entries, zeta, alpha],
    }),
    changesStatus: "disabled",
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });

  assert.equal(
    model.screens.find(({ path }) => path === zeta.path)?.variantOf,
    parent.path,
  );
  assert.deepEqual(
    model.screens
      .filter(({ path }) => [parent.path, zeta.path, alpha.path].includes(path))
      .map(({ path }) => path),
    [parent.path, zeta.path, alpha.path],
  );
  assert.deepEqual(findNode(model.tree, parent.path), {
    children: [
      { path: zeta.path, kind: "entry" },
      { path: alpha.path, kind: "entry" },
    ],
    path: parent.path,
    kind: "entry",
  });
  const roundTrip = readCatalogue(JSON.parse(serializeCatalogue(model)));
  assert.deepEqual(roundTrip, model);
  assert.deepEqual(
    findNode(roundTrip.tree, parent.path),
    findNode(model.tree, parent.path),
  );
});

test("removed variants keep baseline authored order at a surviving parent's position", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const current = entryAt(fixture.after.manifest, "home", "screen");
  const removedScreen = (id: string, variantOf?: string) => ({
    folderTitles: [],
    ...(variantOf === undefined ? {} : { parentTitle: current.title }),
    entry: {
      ...structuredClone(current),
      path: id,
      title: id,
      ...(variantOf === undefined ? {} : { variantOf }),
    },
  });
  const catalogue = createCatalogue(fixture.after.manifest, [
    removedScreen("a-removed"),
    removedScreen("z-variant", current.path),
    removedScreen("b-variant", current.path),
    removedScreen("m-removed"),
  ]);
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue,
    changesStatus: "ready",
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });

  assert.deepEqual(
    model.removedEntries.map(({ entry }) => entry.path),
    ["a-removed", "z-variant", "b-variant", "m-removed"],
  );
});

test("public v5 fixture conforms and compatible readers ignore additive fields", async () => {
  const json = await fs.readFile(
    "docs/protocol/fixtures/catalogue-v5.json",
    "utf8",
  );
  const fixture = JSON.parse(json);
  const model = readCatalogue(fixture);
  assert.equal(model.schemaVersion, 5);
  assert.deepEqual(
    model.removedEntries.map(({ entry, preview }) => [entry.kind, preview]),
    [
      [
        "page",
        {
          kind: "page",
        },
      ],
      ["screen", { kind: "screen" }],
    ],
  );
  assert.equal(serializeCatalogue(model), json);
  fixture.future = { description: "An additive field" };
  fixture.screens[0].future = true;
  fixture.screens[0].views[0].usage.future = true;
  assert.deepEqual(readCatalogue(fixture), model);
  assert.throws(
    () => readCatalogue({ ...fixture, schemaVersion: 3 }),
    /Unsupported Mokly catalogue version/,
  );
  assert.throws(() => readCatalogue({ ...fixture, schemaVersion: 2 }));
  assert.throws(() => readCatalogue({ ...fixture, schemaVersion: 1 }));
  assert.throws(() =>
    readCatalogue({
      schemaVersion: 6 as const,
      generatedBy: "mokly",
      entries: [],
    }),
  );
});

test("reader rejects unsafe paths, private extensions and broken known references", async () => {
  const fixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v5.json", "utf8"),
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
      value.screens[0].views[0].viewport = "tablet";
    },
    (value: typeof fixture) => {
      value.screens[0].views[0].colorScheme = "sepia";
    },
    (value: typeof fixture) => {
      value.comparisonUrl = "mokly-viewer/diffs/review.json";
    },
    (value: typeof fixture) => {
      value.sourceFiles = ["entries/source.tsx"];
    },
    (value: typeof fixture) => {
      value.extension = { styles: [{ startOffset: 2 }] };
    },
    (value: typeof fixture) => {
      value.tree[0].children[0].children[0].path = "missing";
    },
    (value: typeof fixture) => {
      value.screens[0].useCasePaths = ["missing"];
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

function findNode(
  nodes: readonly CatalogueNode[],
  id: string,
): CatalogueNode | undefined {
  for (const node of nodes) {
    if (node.kind === "entry" && node.path === id) return node;
    if (node.children) {
      const nested = findNode(node.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

type CurrentManifestScreen = Extract<
  ManifestV9["entries"][number],
  { kind: "screen" }
>;
