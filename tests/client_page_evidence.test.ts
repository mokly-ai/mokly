import assert from "node:assert/strict";
import test from "node:test";

import { PAGE_STYLE_COPY } from "../examples/basic/entries/design/parts/stylesheet_evidence.js";
import { entryWording } from "../packages/viewer/dist/shell/entry_wording.js";
import { stylesheetEvidence } from "../packages/viewer/dist/shell/workspace_stylesheet_evidence.js";

import { cssReason, cssRule } from "./helpers/css_evidence.js";

const ACTIONS = "mockups/actions.css";
const HANDBOOK = "mockups/handbook.css";
const PAGE = { kind: "page" } as const;

/** `.action` changes Action on its own pages and also styles the page's link. */
const outsideRule = cssRule({
  ruleKey: "1".repeat(64),
  selectors: [".action"],
  changedComponentIds: ["action"],
  pageSelectors: [".action"],
});
/** `article h2` styles only the page and changes no component. */
const headingRule = cssRule({
  ruleKey: "2".repeat(64),
  selectors: ["article h2"],
  pageSelectors: ["article h2"],
});
/** A custom property edit that can reach anything on the page. */
const rootRule = cssRule({
  ruleKey: "3".repeat(64),
  status: "unresolved",
  selectors: [":root"],
});

test("a whole-document page names each stylesheet once with the mockup's page copy", () => {
  assert.deepEqual(
    stylesheetEvidence(
      [
        cssReason(HANDBOOK, [headingRule, rootRule]),
        cssReason(ACTIONS, [outsideRule]),
      ],
      PAGE,
    ),
    [
      {
        path: ACTIONS,
        outcomes: [{ lead: PAGE_STYLE_COPY.outside, selectors: [".action"] }],
      },
      {
        path: HANDBOOK,
        outcomes: [
          { lead: PAGE_STYLE_COPY.matched, selectors: ["article h2"] },
          { lead: PAGE_STYLE_COPY.unresolved, selectors: [":root"] },
        ],
      },
    ],
  );
});

test("a page's unnamed change ends with a full stop and names no style", () => {
  const unnamed = cssRule({ status: "unresolved", selectors: [] });
  assert.deepEqual(
    stylesheetEvidence([cssReason(HANDBOOK, [unnamed])], PAGE)[0]?.outcomes,
    [
      {
        lead: "This change can apply anywhere on the page, so the page stays in Changes.",
        selectors: [],
      },
    ],
  );
});

test("the page wording replaces screen with page in every evidence sentence", () => {
  const page = entryWording("page");
  const screen = entryWording("screen");
  assert.equal(page.filesLead, PAGE_STYLE_COPY.files);
  assert.equal(page.pageStyles, PAGE_STYLE_COPY.matched);
  assert.equal(page.pageOutsideStyles, PAGE_STYLE_COPY.outside);
  assert.equal(page.pageUnresolvedWithSelectors, PAGE_STYLE_COPY.unresolved);
  assert.equal(
    page.excludedStylesheet,
    "This stylesheet changed, but none of the changed styles apply to this page.",
  );
  assert.equal(
    page.excludedStylesheets,
    "These stylesheets changed, but none of the changed styles apply to this page.",
  );
  assert.equal(page.noChanges, "No changes to this page.");
  for (const key of Object.keys(screen) as (keyof typeof screen)[]) {
    const value = screen[key];
    if (typeof value === "string")
      assert.equal(page[key], value.replaceAll("screen", "page"), key);
  }
});
