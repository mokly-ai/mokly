import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPONENT_PAGES,
  CONTROLS_PAGES,
} from "../examples/basic/entries/design/components/parts/destinations.js";
import { NAV_TREE } from "../examples/basic/entries/design/parts/nav_data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  headCrumbs,
  headTitle,
  rowIcon,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";

function componentSection(
  document: Awaited<ReturnType<typeof designDocument>>["document"],
) {
  const section = byClass(document, "mbk-nav-section").find(
    (candidate) => attribute(candidate, "data-nav-section") === "components",
  );
  assert.ok(section, "Missing Components navigation section");
  return section;
}

interface ComponentHeaderExpectation {
  detailsTitle: string;
  heading: string;
  path: string;
  parent?: string;
  status: "Added" | "Changed" | "Removed" | "Unmodified";
}

function assertComponentHeader(
  document: Awaited<ReturnType<typeof designDocument>>["document"],
  expected: ComponentHeaderExpectation,
  id: string,
) {
  assert.equal(headTitle(document), expected.heading, id);
  assert.equal(
    textContent(byClass(document, "mbk-idchip")[0]!).trim(),
    expected.path,
    id,
  );
  assert.equal(
    textContent(byClass(document, "ce-change-status")[0]!).trim(),
    expected.status,
    id,
  );
  const inspector = byClass(document, "ce-inspector")[0];
  assert.ok(inspector, `${id}: missing inspector`);
  const details = textContent(inspector);
  assert.ok(details.includes(`About ${expected.detailsTitle}`), id);
  assert.ok(details.includes(`Path ${expected.path}`), id);
  if (expected.parent === undefined) assert.doesNotMatch(details, /Variant of/);
  else assert.ok(details.includes(`Variant of${expected.parent}`), id);
}

/** Each page: design, heading, path below `example/components`, status, Details title, parent. */
const componentPageHeaders = [
  [COMPONENT_PAGES.default, "Action", "action", "Unmodified", "Action"],
  [
    COMPONENT_PAGES.disabled,
    "Action",
    "action/disabled",
    "Unmodified",
    "Disabled",
    "Action",
  ],
  [
    COMPONENT_PAGES.comparison,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES.overlay,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES.difference,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [
    COMPONENT_PAGES["overlay-tall"],
    "Checklist",
    "checklist/default",
    "Changed",
    "Default",
    "Checklist",
  ],
  [
    COMPONENT_PAGES.affected,
    "Action",
    "action/default",
    "Changed",
    "Default",
    "Action",
  ],
  [COMPONENT_PAGES.toolbar, "Toolbar", "toolbar", "Unmodified", "Toolbar"],
  [COMPONENT_PAGES.hidden, "Help hint", "help-hint", "Unmodified", "Help hint"],
  [COMPONENT_PAGES.unused, "Badge", "badge", "Unmodified", "Badge"],
  [
    COMPONENT_PAGES.added,
    "Badge",
    "badge/default",
    "Added",
    "Default",
    "Badge",
  ],
  [
    COMPONENT_PAGES.removed,
    "Action",
    "action/compact",
    "Removed",
    "Compact",
    "Action",
  ],
  [
    COMPONENT_PAGES["shared-impact"],
    "Action",
    "action",
    "Unmodified",
    "Action",
  ],
  [COMPONENT_PAGES.closed, "Action", "action", "Unmodified", "Action"],
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component page headers and Details describe the shown entry`, async () => {
    for (const [
      id,
      heading,
      entryPath,
      status,
      detailsTitle,
      parent,
    ] of componentPageHeaders) {
      const { document } = await designDocument(id, viewport);
      assertComponentHeader(
        document,
        {
          detailsTitle,
          heading,
          path: `example/components/${entryPath}`,
          ...(parent === undefined ? {} : { parent }),
          status,
        },
        id,
      );
    }
  });

  test(`${viewport}: controls pages identify their selected component variant`, async () => {
    for (const [state, id] of Object.entries(CONTROLS_PAGES)) {
      const disabled = state === "variant" || state === "readonly-variant";
      const { document } = await designDocument(id, viewport);
      assertComponentHeader(
        document,
        {
          detailsTitle: disabled ? "Disabled" : "Default",
          heading: "Action",
          path: disabled
            ? "example/components/action/disabled"
            : "example/components/action/default",
          parent: "Action",
          status: state === "comparison" ? "Changed" : "Unmodified",
        },
        id,
      );
    }
  });
}

test("shared navigation data follows the real component variant ids and authored order", async () => {
  const { manifest } = await designCatalogue;
  for (const parentId of ["example-action", "example-toolbar"]) {
    const parent = manifest.entries.find((entry) => entry.id === parentId);
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
      .map((entry) => [entry.id, entry.title, "component"]);
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
      "design-browse-navigation",
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
      "design-browse-variant-reparented",
      viewport,
    );
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design-browse-home"],
      ["Example", undefined],
      ["Screens", undefined],
      ["Welcome", undefined],
    ]);
  });
}

test("component explorer and Changes mockups disclose the relevant variants", async () => {
  for (const [id, labels] of [
    [
      "design-component-overview",
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
      "design-component-affected",
      ["Example", "Components", "Action", "Default"],
    ],
    [
      "design-component-removed",
      ["Example", "Components", "Action", "Compact · Removed"],
    ],
  ] as const) {
    const { document } = await designDocument(id, "desktop");
    assert.deepEqual(rowLabels(componentSection(document)), labels, id);
  }
});

test("component variant rows use a component-shaped glyph without changing the screen glyph", async () => {
  const component = await designDocument(
    "design-component-overview",
    "desktop",
  );
  const screen = await designDocument(
    "design-browse-variant-selected",
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
