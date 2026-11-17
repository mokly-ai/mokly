import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { catalogueEntries } from "./catalogue-index";
import { catalogueViolations, sourceTreeViolations } from "./catalogue-policy";
import { drawnPalette } from "./catalogue-reads";
import { variantParent } from "./catalogue-variants";
import {
  FixtureScreen,
  fixtureCatalogue,
  fixtureState,
} from "./definition-fixtures";
import { folioInventoryViolations } from "./folio-inventory";
import { loadCatalogue, loadDefinitions } from "./load-catalogue";
import type { CatalogueDefinition } from "./load-catalogue";

test("registry policy accepts screens with variants and rejects missing views, themes, folders, caps and broken flows", () => {
  assert.deepEqual(catalogueViolations(fixtureCatalogue()), []);
  assert.equal(variantParent(fixtureCatalogue()[1]), "product/screen");
  const mutations: [string, (entries: CatalogueDefinition[]) => void][] = [
    ["duplicate entry path", (entries) => entries.push(entries[0])],
    [
      "both viewports required",
      (entries) =>
        Object.assign(entries[0], {
          render: (_props: unknown, { viewport }: { viewport: string }) =>
            viewport === "desktop" ? createElement(FixtureScreen) : null,
        }),
    ],
    [
      "one component per screen",
      (entries) =>
        Object.assign(entries[0], {
          render: (_props: unknown, { viewport }: { viewport: string }) =>
            viewport === "desktop"
              ? createElement("div")
              : createElement(FixtureScreen),
        }),
    ],
    [
      "both themes required",
      (entries) => Object.assign(entries[0], { colorSchemes: ["light"] }),
    ],
    [
      "invalid reciprocal flow",
      (entries) => Object.assign(entries[0], { useCasePaths: ["missing"] }),
    ],
    [
      "flow requires a reciprocal screen",
      (entries) =>
        Object.assign(entries[2], { steps: [{ screenPath: "missing" }] }),
    ],
    [
      "flow references use screen paths",
      (entries) =>
        Object.assign(entries[2], {
          steps: [{ screenPath: entries[0] }, { screenPath: "product/screen" }],
        }),
    ],
    [
      "flow references use screen paths",
      (entries) => Object.assign(entries[0], { useCasePaths: [entries[2]] }),
    ],
    [
      "folder outside the catalogue roots",
      (entries) => Object.assign(entries[0], { path: "elsewhere/screen" }),
    ],
    [
      "variant needs a parent of its kind and path",
      (entries) => Object.assign(entries[1], { variantOf: "missing" }),
    ],
    [
      "variant needs a parent of its kind and path",
      (entries) =>
        Object.assign(entries[1], { path: "product/elsewhere/empty" }),
    ],
    [
      "at most four variants per screen",
      (entries) => entries.push(...["a", "b", "c", "d"].map(fixtureState)),
    ],
  ];
  for (const [message, mutation] of mutations) {
    const entries = fixtureCatalogue();
    mutation(entries);
    assert.ok(
      catalogueViolations(entries).some((problem) =>
        problem.startsWith(message),
      ),
      message,
    );
  }
});

test("entry modules mirror the folder tree", async () => {
  const loaded = await loadDefinitions();
  assert.deepEqual(sourceTreeViolations(loaded), []);
  const [first, second] = loaded;
  assert.ok(first && second);
  for (const damaged of [
    [{ ...first, module: "elsewhere/" + first.module }, second],
    [
      first,
      {
        definition: { ...second.definition, path: "somewhere/else" },
        module: second.module.replace(/[^/]+$/, "other.mockup.tsx"),
      },
    ],
  ])
    assert.ok(sourceTreeViolations(damaged).length > 0);
});

test("the authored catalogue contains the product, site and registered component inventory", async () => {
  const entries = await loadCatalogue();
  const records = catalogueEntries();
  assert.deepEqual(catalogueViolations(entries), []);
  assert.deepEqual(folioInventoryViolations(records, drawnPalette), []);
  assert.equal(entries.filter((entry) => entry.kind === "useCase").length, 4);
  const components = entries.filter(
    (entry) => entry.kind === "component" && variantParent(entry) === undefined,
  );
  assert.equal(components.length, 23);
  assert.deepEqual(
    records.filter(
      (record) => record.kind === "screen" && record.tags.includes("variant"),
    ),
    [],
  );
  for (const path of [
    "marketing/home",
    "product/workspace/project",
    "product/review/thread",
  ])
    assert.ok(
      folioInventoryViolations(
        [...records, { kind: "screen", path }],
        drawnPalette,
      ).length,
      path,
    );
  for (const entry of components) {
    const saved = entries.filter(
      (candidate) => variantParent(candidate) === entry.path,
    );
    assert.ok(saved.length > 0 && saved.length <= 5, entry.path);
    for (const variant of saved)
      assert.ok(variant.path.startsWith(entry.path + "/"), variant.path);
    const [first] = saved;
    assert.ok(first, entry.path);
    const overfull = [
      ...entries,
      ...[1, 2, 3, 4, 5].map((index) => ({
        ...first,
        path: entry.path + "/extra-" + index,
        slug: "extra-" + index,
      })),
    ];
    assert.ok(
      catalogueViolations(overfull).some((message) =>
        message.startsWith("one to five"),
      ),
    );
  }
});

test("component policy rejects a parent with zero saved variants", async () => {
  const parent = (await loadCatalogue()).find(
    (entry) => entry.kind === "component" && variantParent(entry) === undefined,
  );
  assert.ok(parent);
  assert.deepEqual(catalogueViolations([parent]), [
    "one to five saved variants: " + parent.path,
  ]);
});

test("source policy preserves letter case and refuses case collisions", () => {
  const entries = fixtureCatalogue();
  Object.assign(entries[0], { path: "product/Screen" });
  Object.assign(entries[1], {
    path: "product/Screen/empty",
    variantOf: "product/Screen",
  });
  Object.assign(entries[2], {
    steps: [{ screenPath: "product/Screen" }, { screenPath: "product/Screen" }],
  });
  assert.deepEqual(catalogueViolations(entries), []);
  assert.ok(
    catalogueViolations([
      ...entries,
      { ...entries[0], path: "product/screen" },
    ]).includes("duplicate entry path"),
  );
});
