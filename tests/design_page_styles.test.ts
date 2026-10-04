import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { stylesheetGroups } from "./helpers/design_evidence.js";
import {
  filterTargets,
  headCrumbs,
  headTitle,
  navRows,
} from "./helpers/design_rows.js";

const PAGE_STYLES = "design-review-style-page";
const PAGE_VIEW = "design-page-view";
const ACTION_STYLES = "design-component-style-changed";
const ACTION_VARIANTS = ["Default", "Disabled", "Secondary"];
/** The handbook, Action and Action's three saved variants. */
const CHANGES = "5";

/** The whole-document page sentences that the presentation contract fixes. */
const PAGE_COPY = {
  files: "Changes to these files may affect this page:",
  matched: "Changed styles that apply to this page:",
  outside:
    "These changed styles also apply outside the changed components on this page:",
  unresolved:
    "This change can apply anywhere on the page, so the page stays in Changes:",
};

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: a changed document names each stylesheet once with the page copy`, async () => {
    const { document, entry, route } = await designDocument(
      PAGE_STYLES,
      viewport,
    );
    assert.equal(entry.title, "Document page styles");
    assert.equal(entryRoute("screen", entry.id), `screens/${PAGE_STYLES}.html`);
    assert.deepEqual(entry.colorSchemes, ["light"]);
    assert.deepEqual(entry.navPath, [
      "Design",
      "Mokly design",
      "Changes",
      "Impact states",
      "Stylesheet evidence",
    ]);
    const [card, ...others] = byClass(document, "mbk-comparison-details");
    assert.ok(card, route);
    assert.equal(others.length, 0, route);
    assert.deepEqual(
      elements(card, (node) => node.tagName === "h3").map(textContent),
      ["Comparison details"],
    );
    assert.match(
      textContent(card),
      /Compared with the branch point on origin\/main\./,
    );
    assert.deepEqual(stylesheetGroups(card, route), {
      lead: PAGE_COPY.files,
      files: [
        ["styles/actions.css", [[PAGE_COPY.outside, [".action"]]]],
        [
          "styles/handbook.css",
          [
            [PAGE_COPY.matched, ["article h2"]],
            [PAGE_COPY.unresolved, [":root"]],
          ],
        ],
      ],
    });
    assert.doesNotMatch(
      textContent(card),
      /screen|saved view|Changed component|Shared component changes/,
      "a page consumes no components and keeps the page wording",
    );
    for (const heading of elements(document, (node) =>
      ["h1", "h2", "h3", "h4"].includes(node.tagName),
    ))
      assert.doesNotMatch(
        textContent(heading),
        /\.action|article h2|:root|\.css/,
        route,
      );
  });

  test(`${viewport}: a changed document keeps its page stage without comparison controls`, async () => {
    const { document, route } = await designDocument(PAGE_STYLES, viewport);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0, route);
    assert.equal(byClass(document, "mbk-comparison-stage").length, 0, route);
    assert.equal(byClass(document, "mbk-compare").length, 0, route);
    assert.equal(headTitle(document), "Getting started");
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design-browse-home"],
      ["Example", undefined],
    ]);
    assert.equal(
      textContent(byClass(document, "mbk-idchip")[0]!),
      "#example-handbook",
    );
    const status = byClass(document, "ce-change-status");
    assert.deepEqual(status.map(textContent), ["Changed"]);
    assert.equal(attribute(status[0]!, "data-change-status"), "changed");
    const [pane, ...panes] = byClass(document, "mbk-doc-pane");
    assert.ok(pane, route);
    assert.equal(panes.length, 0, route);
    assert.match(textContent(pane), /Getting started.*Next steps/s);
    const welcome = elements(
      pane,
      (node) => node.tagName === "a" && textContent(node) === "Open Welcome",
    );
    assert.deepEqual(
      welcome.map((link) => attribute(link, "data-mokly-link")),
      ["design-browse-screen"],
    );
  });
}

test("desktop: Changes lists the changed document beside Action and its saved variants", async () => {
  const { document } = await designDocument(PAGE_STYLES, "desktop");
  assert.deepEqual(navRows(document, "pages"), [
    ["Example", false, undefined, undefined],
    ["Getting started", true, PAGE_STYLES, "page"],
  ]);
  assert.deepEqual(navRows(document, "components"), [
    ["Example", false, undefined, undefined],
    ["Components", false, undefined, undefined],
    ["Action", true, ACTION_STYLES, undefined],
    ...ACTION_VARIANTS.map((label) => [label, true, undefined, undefined]),
  ]);
  assert.deepEqual(
    byClass(document, "mbk-nav-filter-opt")
      .filter((option) => (attribute(option, "class") ?? "").includes("active"))
      .map((option) => textContent(option).trim()),
    [`Changes${CHANGES}`],
  );
  assert.deepEqual(filterTargets(document), [["All", PAGE_VIEW]]);
});

test("the page designs open the changed document from their Changes filter", async () => {
  for (const [id, viewport] of [
    [PAGE_VIEW, "desktop"],
    ["design-page-details", "desktop"],
    ["design-page-navigation", "desktop"],
    ["design-page-navigation", "mobile"],
  ] as const) {
    const { document } = await designDocument(id, viewport);
    assert.deepEqual(
      filterTargets(document),
      [[`Changes${CHANGES}`, PAGE_STYLES]],
      `${id}/${viewport}`,
    );
    assert.deepEqual(
      byClass(document, "mbk-nav-filter-count").map(textContent),
      [CHANGES],
      `${id}/${viewport}`,
    );
  }
  for (const id of [PAGE_VIEW, "design-page-details"]) {
    const { document } = await designDocument(id, "mobile");
    assert.equal(byClass(document, "mbk-nav-filter").length, 0, id);
  }
});
