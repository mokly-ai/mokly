import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import { headCrumbs, headTitle, rowLabels } from "./helpers/design_rows.js";
import { textOutput } from "./helpers/generated_text.js";

const REMOVED_PARENT = "design/components/states/moved-variants/removed-parent";

type Node = Parameters<typeof byClass>[0];

function text(node: Node): string {
  return textContent(node).replace(/\s+/gu, " ").trim();
}

/** Each metadata row's label and value, as Details lists them. */
function metaRows(node: Node): [string, string][] {
  return byClass(node, "mbk-meta-row").map((row) => [
    text(byClass(row, "mbk-meta-k")[0]!),
    text(byClass(row, "mbk-meta-v")[0]!),
  ]);
}

/** The inspector panel with one label, such as Details or Props. */
function panel(node: Node, label: string): Element {
  const found = byClass(node, "ce-inspector-panel").find(
    (candidate) => attribute(candidate, "aria-label") === label,
  );
  assert.ok(found, `missing ${label} panel`);
  return found;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: a removed parent whose variants moved lists them instead of empty controls`, async () => {
    const { document, entry } = await designDocument(REMOVED_PARENT, viewport);
    assert.deepEqual(entry.colorSchemes, ["light"]);
    assert.equal(headTitle(document), "Link button");
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design/browse/views/home"],
    ]);
    assert.equal(text(byClass(document, "mbk-pathchip")[0]!), "link-button");
    assert.equal(byClass(document, "ce-removed").length, 1);
    assert.equal(byClass(document, "ce-variants").length, 0);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0);
    const stages = byClass(document, "mbk-empty");
    assert.equal(stages.length, 1);
    const stage = stages[0]!;
    assert.equal(
      text(elements(stage, (node) => node.tagName === "h2")[0]!),
      "This component was removed",
    );
    assert.equal(
      text(elements(stage, (node) => node.tagName === "p")[0]!),
      "Its variants moved to new places.",
    );
    assert.deepEqual(byClass(stage, "mbk-empty-link").map(text), [
      "Action › Quiet",
      "Toolbar › Inline",
    ]);
    assert.doesNotMatch(text(document), /Select a comparison/u);
    const details = panel(document, "Details");
    assert.match(text(details), /Path link-button/u);
    assert.doesNotMatch(text(details), /Location/u);
    assert.match(
      text(panel(document, "Props")),
      /This component has no saved variants to edit\./u,
    );
    if (viewport === "desktop") {
      const nav = byClass(document, "mbk-nav-scroll")[0]!;
      assert.deepEqual(rowLabels(nav), [
        "Example",
        "Components",
        "Action",
        "Quiet · Moved",
        "Toolbar",
        "Inline · Moved",
        "Link button · Removed",
      ]);
      assert.equal(text(byClass(document, "mbk-nav-filter-count")[0]!), "3");
    } else assert.equal(text(byClass(document, "ce-change-count")[0]!), "3");
  });

  test(`${viewport}: a removed entry inside a folder names its folders in Location`, async () => {
    for (const [path, location] of [
      ["design/changes/outcomes/removed", "Example › Screens"],
      ["design/browse/variants/variant-removed", "Example › Screens"],
      ["design/browse/pages/removed", "Example › Handbook"],
      [
        "design/browse/appearance/states/light-only-document",
        "Account › Billing & Payments",
      ],
    ] as const) {
      const { document } = await designDocument(path, viewport);
      assert.deepEqual(
        metaRows(document).filter(([label]) => label === "Location"),
        [["Location", location]],
        path,
      );
    }
    for (const path of [
      "design/components/states/removed",
      "design/components/states/removed-consumer",
    ]) {
      const { document } = await designDocument(path, viewport);
      assert.match(
        text(panel(document, "Details")),
        path.endsWith("consumer")
          ? /Location Example › Screens/u
          : /Location Example › Components/u,
        path,
      );
    }
  });
}

test("no design document draws an empty Location row or the former Location line", async () => {
  const { outputs } = await designCatalogue;
  for (const route of [...outputs.keys()].sort()) {
    if (!route.endsWith(".html")) continue;
    const html = textOutput(outputs, route);
    if (html === undefined) continue;
    const document = parse(html);
    for (const [label, value] of metaRows(document))
      if (label === "Location") assert.notEqual(value, "", route);
    assert.doesNotMatch(text(document), /Location:/u, route);
  }
});
