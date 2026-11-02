import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../src/shell/catalogue.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";
import {
  treeRecord,
  treeModel,
  entryNode,
  folderNode,
} from "./tree_fixture.js";

test("a catalogue keeps the previous path of each current entry a move paired", () => {
  const model = treeModel(
    [
      {
        ...treeRecord("account/billing/invoice", "screen"),
        previousPath: "billing/invoice",
      },
      treeRecord("home", "screen"),
    ],
    [
      folderNode("account", "Account", [
        folderNode("account/billing", "Billing", [
          entryNode("account/billing/invoice"),
        ]),
      ]),
      entryNode("home"),
    ],
  );
  const catalogue = createCatalogue(model);
  assert.deepEqual(
    [...catalogue.previousPaths],
    [["account/billing/invoice", "billing/invoice"]],
  );
  assert.equal(
    createCatalogue(
      treeModel([treeRecord("home", "screen")], [entryNode("home")]),
    ).previousPaths.size,
    0,
  );
});

test("the public viewer reads each paired entry's previous path from the read model", () => {
  const catalogue = catalogueFixture(
    indexFixture((model) => {
      const details = model.screens.find(
        (entry) => entry.path === "product/browse/details",
      );
      assert.ok(details);
      details.previousPath = "product/details";
    }),
  );
  assert.deepEqual(
    [...catalogue.previousPaths],
    [["product/browse/details", "product/details"]],
  );
});

test("component parents without variants keep Dark available from their own views", () => {
  const component = catalogueFixture().publicModel.components.find(
    (entry) => entry.variantOf === undefined,
  );
  assert.ok(component);
  assert.ok(component.views.length);
  const catalogue = createCatalogue({
    ...treeModel([], []),
    components: [
      {
        ...component,
        colorSchemes: ["light", "dark"],
        views: component.views.flatMap((view) => [
          view,
          { ...view, colorScheme: "dark" as const },
        ]),
      },
    ],
    tree: [folderNode("components", "Components", [entryNode(component.path)])],
  });
  assert.equal(catalogue.hasDarkFragments, true);
});
