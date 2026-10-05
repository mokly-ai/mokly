import assert from "node:assert/strict";
import { test } from "node:test";

import { serializeOuter } from "parse5";

import { entryRoute } from "../packages/viewer/dist/data.js";
import { entryWording } from "../packages/viewer/dist/shell/entry_wording.js";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import { stylesheetGroups } from "./helpers/design_evidence.js";
import { filterTargets, headTitle, navRows } from "./helpers/design_rows.js";

const EXCLUDED = "design-review-style-excluded";
const MATCHED = "design-review-style-matched";
const ONLY = "design-review-style-excluded-only";
const VIEWPORTS = ["mobile", "desktop"] as const;
const SCREEN = entryWording("screen");
const BRANCH_POINT = "Compared with the branch point on origin/main.";

type Document = Awaited<ReturnType<typeof designDocument>>["document"];

/** The one comparison details section that a design document draws. */
function detailsCard(document: Document, where: string): Element {
  const [card, ...others] = byClass(document, "mbk-comparison-details");
  assert.ok(card, `${where}: missing comparison details`);
  assert.equal(others.length, 0, `${where}: one comparison details section`);
  return card;
}

/** The card's own elements, without the evidence nested in a file's item. */
function ownElements(card: Element, tagName: string): Element[] {
  return card.childNodes.filter(
    (node): node is Element => "tagName" in node && node.tagName === tagName,
  );
}

/** The card's own sentences, in the order a reader meets them. */
function sentences(card: Element): string[] {
  return ownElements(card, "p").map((node) => textContent(node).trim());
}

/** The files the card lists as examined and excluded. */
function excludedFiles(card: Element): string[] {
  return ownElements(card, "ul")
    .filter((list) => !byClass(list, "mbk-evidence-files").length)
    .flatMap((list) => elements(list, (node) => node.tagName === "li"))
    .map((item) => textContent(item).trim());
}

for (const viewport of VIEWPORTS)
  test(`${viewport}: Excluded styles only opens unchanged Details from All without a comparison`, async () => {
    const { document, entry, route } = await designDocument(ONLY, viewport);
    assert.equal(entry.title, "Excluded styles only");
    assert.equal(entryRoute("screen", entry.id), `screens/${ONLY}.html`);
    assert.deepEqual(entry.colorSchemes, ["light"]);
    assert.equal(headTitle(document), "Details");
    assert.equal(
      textContent(byClass(document, "mbk-idchip")[0]!),
      "#example-details",
    );
    const status = byClass(document, "ce-change-status");
    assert.deepEqual(status.map(textContent), ["Unmodified"]);
    assert.equal(attribute(status[0]!, "data-change-status"), "unmodified");
    for (const name of ["mbk-cmp-toolbar", "mbk-comparison-stage"])
      assert.equal(byClass(document, name).length, 0, `${route}: ${name}`);
    assert.equal(byClass(document, "mbk-compare").length, 0, route);
    const card = detailsCard(document, route);
    assert.equal(byClass(card, "mbk-evidence-files").length, 0, route);
    assert.deepEqual(sentences(card), [
      BRANCH_POINT,
      SCREEN.excludedStylesheet,
      "Examined and excluded:",
      SCREEN.noChanges,
    ]);
    assert.deepEqual(excludedFiles(card), ["generated/excluded.css"]);
  });

test("desktop: Excluded styles and Excluded styles only depict one branch and link each other", async () => {
  const rows = (active: string) => [
    ["Example", false, undefined, undefined],
    ["Screens", false, undefined, undefined],
    ["Welcome", true, EXCLUDED, active === EXCLUDED ? "page" : undefined],
    ["Details", false, ONLY, active === ONLY ? "page" : undefined],
    ["Example tour", false, "design-browse-use-case", undefined],
    ["Design", false, undefined, undefined],
    ["Browse shell", false, undefined, undefined],
    ["Changes", false, undefined, undefined],
  ];
  for (const [id, changes] of [
    [EXCLUDED, [["Changes1", MATCHED]]],
    [ONLY, []],
  ] as const) {
    const { document } = await designDocument(id, "desktop");
    assert.deepEqual(navRows(document, "pages"), rows(id), id);
    assert.deepEqual(
      byClass(document, "mbk-nav-filter-opt").map((option) => [
        textContent(option).trim(),
        byClass(option, "active").includes(option),
      ]),
      [
        ["All", true],
        ["Changes1", false],
      ],
      id,
    );
    assert.deepEqual(filterTargets(document), changes, id);
  }
});

test("Excluded styles and Matched styles show one identical Details card", async () => {
  const cards: [string, string][] = [];
  for (const viewport of VIEWPORTS)
    for (const id of [EXCLUDED, MATCHED]) {
      const { document, route } = await designDocument(id, viewport);
      const card = detailsCard(document, route);
      cards.push([route, serializeOuter(card)]);
      assert.deepEqual(stylesheetGroups(card, route), {
        lead: SCREEN.filesLead,
        files: [
          [
            "generated/styles.css",
            [[SCREEN.matchedStylesWithSelectors, [".example-head", "main a"]]],
          ],
        ],
      });
      assert.deepEqual(sentences(card), [
        BRANCH_POINT,
        SCREEN.filesLead,
        SCREEN.excludedStylesheet,
        "Examined and excluded:",
      ]);
      assert.deepEqual(excludedFiles(card), ["generated/excluded.css"]);
    }
  for (const [route, card] of cards) assert.equal(card, cards[0]![1], route);
});

test("the shell stylesheet evidence designs show only the viewer's Details copy", async () => {
  const viewer = new Set(
    [entryWording("screen"), entryWording("page")]
      .flatMap((wording) => Object.values(wording))
      .filter((copy): copy is string => typeof copy === "string"),
  );
  viewer.add(BRANCH_POINT);
  viewer.add("Examined and excluded:");
  for (const id of [
    "design-review-style-page",
    MATCHED,
    EXCLUDED,
    ONLY,
    "design-review-style-unresolved",
    "design-review-style-unnamed",
  ])
    for (const viewport of VIEWPORTS) {
      const { document, route } = await designDocument(id, viewport);
      for (const sentence of elements(
        detailsCard(document, route),
        (node) => node.tagName === "p",
      ).map((node) => textContent(node).trim()))
        assert.ok(viewer.has(sentence), `${route}: "${sentence}"`);
    }
});
