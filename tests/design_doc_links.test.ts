import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  filterTargets,
  headCrumbs,
  rowLabel,
  rowLabels,
} from "./helpers/design_rows.js";

type Document = Awaited<ReturnType<typeof designDocument>>["document"];

/** The destination of the one anchor whose text is exactly `label`. */
function linkTarget(document: Document, label: string): string | undefined {
  const links = elements(
    document,
    (node) => node.tagName === "a" && textContent(node).trim() === label,
  );
  assert.equal(links.length, 1, label);
  return attribute(links[0]!, "data-mokly-link");
}

function activeRow(document: Document) {
  const rows = byClass(document, "mbk-nav-row").filter(
    (row) => attribute(row, "aria-current") === "page",
  );
  assert.equal(rows.length, 1);
  return rows[0]!;
}

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`${viewport} ${scheme}: doc designs pair their inspector, drawer and links`, async () => {
      for (const [id, inspector, menu] of [
        ["design-doc-view", "design-doc-details", "design-doc-navigation"],
        ["design-doc-details", "design-doc-view", "design-doc-navigation"],
        ["design-doc-navigation", "design-doc-details", "design-doc-view"],
      ] as const) {
        const { document } = await designDocument(id, viewport, scheme);
        assert.equal(
          attribute(
            byClass(document, "ce-inspector-link")[0]!,
            "data-mokly-link",
          ),
          inspector,
          id,
        );
        assert.equal(
          linkTarget(document, "Open the Welcome screen"),
          "design-browse-screen",
          id,
        );
        const menuButton = byClass(document, "mbk-menu-btn");
        assert.equal(menuButton.length, Number(viewport === "mobile"), id);
        if (viewport === "mobile")
          assert.equal(
            attribute(menuButton[0]!, "data-mokly-link"),
            menu,
            `${id}: menu`,
          );
        const drawn = viewport === "desktop" || id === "design-doc-navigation";
        assert.equal(byClass(document, "mbk-nav").length, Number(drawn), id);
        if (!drawn) continue;
        const row = activeRow(document);
        assert.equal(rowLabel(row), "Welcome specification", id);
        assert.equal(attribute(row, "data-mokly-link"), "design-doc-view", id);
        assert.deepEqual(
          filterTargets(document),
          [["Changes1", "design-doc-removed"]],
          `${id}: Changes holds the removed doc`,
        );
      }
      const details = await designDocument(
        "design-doc-details",
        viewport,
        scheme,
      );
      assert.equal(
        linkTarget(details.document, "notes.md"),
        "design-doc-view",
        "a related doc that is a current doc opens a doc",
      );
    });

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: a removed doc keeps a flat Changes row and baseline crumbs`, async () => {
    const { document } = await designDocument("design-doc-removed", viewport);
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design-browse-home"],
      ["Example", undefined],
      ["Guides", undefined],
    ]);
    assert.deepEqual(
      byClass(document, "ce-removed").map((node) => textContent(node).trim()),
      ["Removed"],
    );
    assert.deepEqual(
      byClass(document, "mbk-previous").map((node) => textContent(node).trim()),
      ["Showing previous version"],
    );
    assert.equal(
      elements(
        byClass(document, "mbk-doc-view")[0]!,
        (node) => node.tagName === "a",
      ).length,
      0,
      "links inside a previous version do nothing",
    );
    if (viewport === "mobile") return;
    assert.deepEqual(rowLabels(document), ["Naming guide · Removed"]);
    const row = activeRow(document);
    assert.equal(attribute(row, "data-mokly-link"), "design-doc-removed");
    assert.deepEqual(filterTargets(document), [["All", "design-browse-home"]]);
  });

test("existing Browse shell designs reach the doc through the catalogue tree", async () => {
  for (const id of [
    "design-browse-home",
    "design-browse-screen",
    "design-browse-details-screen",
    "design-browse-use-case",
    "design-browse-tag-onboarding",
  ]) {
    const { document } = await designDocument(id, "desktop");
    const rows = byClass(document, "mbk-nav-row").filter(
      (row) => rowLabel(row) === "Welcome specification",
    );
    assert.equal(rows.length, 1, id);
    assert.equal(attribute(rows[0]!, "data-mokly-link"), "design-doc-view", id);
    assert.equal(attribute(rows[0]!, "aria-current"), undefined, id);
  }
});
