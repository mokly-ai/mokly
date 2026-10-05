import assert from "node:assert/strict";
import { test } from "node:test";

import { NAV_TREE } from "../examples/basic/specs/design/parts/nav_data.js";

import {
  attribute,
  designCatalogue,
  designDocument,
} from "./helpers/design_catalogue.js";
import { componentSection } from "./helpers/design_component_navigation.js";
import {
  headCrumbs,
  rowIcon,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";

test("shared navigation data follows the real component variant ids and authored order", async () => {
  const { manifest } = await designCatalogue;
  for (const parentId of [
    "example/components/action",
    "example/components/toolbar",
  ]) {
    const parent = manifest.entries.find((entry) => entry.path === parentId);
    assert.equal(parent?.kind, "component", parentId);
    const parentIndex = NAV_TREE.findIndex((row) => row.key === parentId);
    assert.notEqual(parentIndex, -1, `${parentId} navigation parent`);
    const parentRow = NAV_TREE[parentIndex]!;
    assert.equal(parentRow.variants, "open", parentId);
    const expected = manifest.entries
      .filter(
        (entry) =>
          entry.kind === "component" &&
          "variantOf" in entry &&
          entry.variantOf === parentId,
      )
      .map((entry) => [entry.path, entry.title, "component"]);
    const variants: [string, string, string | undefined][] = [];
    for (const row of NAV_TREE.slice(parentIndex + 1)) {
      if (row.kind !== "variant") break;
      variants.push([
        row.key,
        row.label,
        "variantParentKind" in row ? row.variantParentKind : undefined,
      ]);
    }
    assert.deepEqual(variants, expected, parentId);
  }
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the drawer shows component disclosures and authored variant rows`, async () => {
    const { document } = await designDocument(
      "design/browse/states/navigation",
      viewport,
    );
    const section = componentSection(document);
    assert.deepEqual(rowLabels(section), [
      "Example",
      "Components",
      "Action",
      "Default",
      "Disabled",
      "Secondary",
      "Toolbar",
      "Default",
    ]);
    assert.deepEqual(
      variantToggles(section).map((toggle) => [
        attribute(toggle, "aria-expanded"),
        attribute(toggle, "aria-label"),
      ]),
      [
        ["true", "Hide variants of Action"],
        ["true", "Hide variants of Toolbar"],
      ],
    );
  });

  test(`${viewport}: the reparented removed variant keeps its former parent crumb as plain text`, async () => {
    const { document } = await designDocument(
      "design/browse/variants/variant-reparented",
      viewport,
    );
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design/browse/views/home"],
      ["Example", undefined],
      ["Screens", undefined],
      ["Welcome", undefined],
    ]);
  });
}

test("component explorer and Changes mockups disclose the relevant variants", async () => {
  for (const [id, labels] of [
    [
      "design/components/overview",
      [
        "Example",
        "Components",
        "Action",
        "Default",
        "Disabled",
        "Secondary",
        "Toolbar",
        "Default",
        "Help hint",
        "Default",
        "Badge",
        "Default",
      ],
    ],
    [
      "design/components/pages/affected",
      ["Example", "Components", "Action", "Default"],
    ],
    [
      "design/components/states/removed",
      ["Example", "Components", "Action", "Compact · Removed"],
    ],
  ] as const) {
    const { document } = await designDocument(id, "desktop");
    assert.deepEqual(rowLabels(componentSection(document)), labels, id);
  }
});

test("component variant rows use a component-shaped glyph without changing the screen glyph", async () => {
  const component = await designDocument(
    "design/components/overview",
    "desktop",
  );
  const screen = await designDocument(
    "design/browse/variants/variant-selected",
    "desktop",
  );
  const [componentClass, componentIcon] = rowIcon(
    component.document,
    "Default",
  );
  const [disabledClass, disabledIcon] = rowIcon(component.document, "Disabled");
  const [parentClass, parentIcon] = rowIcon(component.document, "Action");
  const [screenClass, screenIcon] = rowIcon(screen.document, "Empty workspace");
  assert.equal(componentClass, "mbk-nav-ico variant");
  assert.equal(disabledClass, "mbk-nav-ico variant");
  assert.equal(parentClass, "mbk-nav-ico");
  assert.equal(screenClass, "mbk-nav-ico variant");
  assert.equal(componentIcon, disabledIcon);
  assert.notEqual(componentIcon, parentIcon);
  assert.notEqual(componentIcon, screenIcon);
});
