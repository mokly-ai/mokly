import assert from "node:assert/strict";
import test from "node:test";

import { COMPONENT_PANEL_VARIANTS } from "../examples/basic/entries/design/components/parts/destinations.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

const instanceIds = ["footer-action", "help", "main", "toolbar-action"];
const layouts = [
  [COMPONENT_PANEL_VARIANTS.tree, "ce-panel-tree"],
  [COMPONENT_PANEL_VARIANTS.outline, "ce-panel-outline"],
  [COMPONENT_PANEL_VARIANTS.groups, "ce-panel-groups"],
  [COMPONENT_PANEL_VARIANTS.ledger, "ce-panel-ledger"],
] as const;

test("Components panel variants stay in one bounded gallery", async () => {
  const { manifest } = await designCatalogue;
  const collection = manifest.entries.find(
    (entry) => entry.id === "design-component-components-panel",
  );
  assert.ok(collection?.kind === "collection");
  assert.deepEqual(
    collection.childIds,
    Object.values(COMPONENT_PANEL_VARIANTS),
  );
  assert.ok(collection.childIds.length <= 5);
});

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: every Components panel variant renders each real instance once`, async () => {
    for (const [id, className] of layouts) {
      const { document } = await designDocument(id, viewport);
      const layout = byClass(document, className)[0];
      assert.ok(layout, `${id}: missing ${className}`);
      const links = elements(
        layout,
        (node) =>
          node.tagName === "a" &&
          attribute(node, "data-instance-id") !== undefined,
      );
      assert.deepEqual(
        links.map((link) => attribute(link, "data-instance-id")).sort(),
        instanceIds,
        id,
      );
      const selected = links.filter(
        (link) => attribute(link, "aria-current") === "true",
      );
      assert.equal(selected.length, 1, id);
      assert.equal(
        attribute(selected[0]!, "data-instance-id"),
        "footer-action",
      );
      assert.match(textContent(layout), /No visible region/);
    }
  });
}

test("variant disclosure defaults expose the intended comparison", async () => {
  const tree = await designDocument(COMPONENT_PANEL_VARIANTS.tree, "desktop");
  const outline = await designDocument(
    COMPONENT_PANEL_VARIANTS.outline,
    "desktop",
  );
  const groups = await designDocument(
    COMPONENT_PANEL_VARIANTS.groups,
    "desktop",
  );
  const ledger = await designDocument(
    COMPONENT_PANEL_VARIANTS.ledger,
    "desktop",
  );
  const treeLayout = byClass(tree.document, "ce-panel-tree")[0]!;
  const outlineLayout = byClass(outline.document, "ce-panel-outline")[0]!;
  const groupsLayout = byClass(groups.document, "ce-panel-groups")[0]!;

  assert.equal(
    elements(treeLayout, (node) => node.tagName === "details").filter(
      (node) => attribute(node, "open") !== undefined,
    ).length,
    0,
  );
  assert.equal(
    elements(outlineLayout, (node) => node.tagName === "details").filter(
      (node) => attribute(node, "open") !== undefined,
    ).length,
    1,
  );
  assert.equal(
    elements(groupsLayout, (node) => node.tagName === "details").filter(
      (node) => attribute(node, "open") !== undefined,
    ).length,
    3,
  );
  assert.equal(
    byClass(ledger.document, "ce-panel-ledger-head").map(textContent).join(" "),
    "ComponentInstanceInside",
  );
});
