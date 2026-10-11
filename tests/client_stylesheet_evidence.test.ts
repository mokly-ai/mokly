import assert from "node:assert/strict";
import test from "node:test";

import type { EntryChangeReason } from "../packages/viewer/dist/review/component_types.js";
import { stylesheetEvidence } from "../packages/viewer/dist/shell/workspace_stylesheet_evidence.js";

import { cssReason, cssRule } from "./helpers/css_evidence.js";

const RULES = "mockups/rule.css";
const SCREEN = { kind: "screen" } as const;
const ACTION = { kind: "component", componentId: "action" } as const;
const TOOLBAR = { kind: "component", componentId: "toolbar" } as const;

const COPY = {
  screenStyles: "Changed styles that apply to this screen:",
  screenOutside:
    "These changed styles also apply outside the changed components on this screen:",
  screenUnresolved:
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  screenUnnamed:
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  componentStyles: "Changed styles that apply to this component:",
  componentUnresolved:
    "This change can apply anywhere on the component, so the component stays in Changes:",
  viewStyles: "Changed styles that apply to this saved view:",
  viewOutside:
    "These changed styles also apply outside the changed components in this saved view:",
  viewUnresolved:
    "This change can apply anywhere on the saved view, so the saved view stays in Changes:",
  viewUnnamed:
    "This change can apply anywhere on the saved view, so the saved view stays in Changes.",
} as const;

/** `.action, .heading` changes Action and also styles the screen's heading. */
const outsideRule = cssRule({
  ruleKey: "1".repeat(64),
  selectors: [".action", ".heading"],
  changedComponentPaths: ["action"],
  pageSelectors: [".heading"],
});
/** `.action` changes Action and matches nothing else on the page. */
const componentRule = cssRule({
  ruleKey: "2".repeat(64),
  selectors: [".action"],
  changedComponentPaths: ["action"],
});
/** `.checkout-heading` styles only the screen and changes no component. */
const headingRule = cssRule({
  ruleKey: "3".repeat(64),
  selectors: [".checkout-heading"],
  pageSelectors: [".checkout-heading"],
});
/** A custom property edit that can reach anything. */
const toneRule = cssRule({
  ruleKey: "4".repeat(64),
  status: "unresolved",
  selectors: [".tone"],
});

test("a screen names its own page styles under the stylesheet that changed", () => {
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [headingRule])], SCREEN),
    [
      {
        path: RULES,
        outcomes: [
          { lead: COPY.screenStyles, selectors: [".checkout-heading"] },
        ],
      },
    ],
  );
});

test("styles that also changed a component read as outside it, with only the outside selectors", () => {
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [outsideRule])], SCREEN),
    [
      {
        path: RULES,
        outcomes: [{ lead: COPY.screenOutside, selectors: [".heading"] }],
      },
    ],
  );
});

test("component-only selectors stay out of a file's page list", () => {
  const [item] = stylesheetEvidence(
    [cssReason(RULES, [headingRule, componentRule])],
    SCREEN,
  );
  assert.deepEqual(item?.outcomes, [
    { lead: COPY.screenStyles, selectors: [".checkout-heading"] },
  ]);
  assert.doesNotMatch(JSON.stringify(item), /"\.action"/);
});

test("an unresolved paragraph sits beside proven outside matches", () => {
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [outsideRule, toneRule])], SCREEN)[0]
      ?.outcomes,
    [
      { lead: COPY.screenOutside, selectors: [".heading"] },
      { lead: COPY.screenUnresolved, selectors: [".tone"] },
    ],
  );
});

test("a failure with no style to name closes with a full stop and no list", () => {
  const unkeyed = cssRule({ status: "unresolved", selectors: [] });
  delete (unkeyed as { ruleKey?: string }).ruleKey;
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [unkeyed])], SCREEN)[0]?.outcomes,
    [{ lead: COPY.screenUnnamed, selectors: [] }],
  );
});

test("an affected-only screen keeps its full matched styles", () => {
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [componentRule])], SCREEN)[0]
      ?.outcomes,
    [{ lead: COPY.screenStyles, selectors: [".action"] }],
  );
});

test("a component's own pages keep the matched-component sentence", () => {
  const ownPage = cssRule({ ...outsideRule, pageSelectors: [] });
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [ownPage])], ACTION)[0]?.outcomes,
    [{ lead: COPY.componentStyles, selectors: [".action", ".heading"] }],
  );
});

test("a wrapper-only rule gives a saved view its own page sentence", () => {
  const frame = cssRule({ selectors: [".frame"], pageSelectors: [".frame"] });
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [frame])], ACTION)[0]?.outcomes,
    [{ lead: COPY.viewStyles, selectors: [".frame"] }],
  );
});

test("a component rule that also styles the wrapper keeps both facts", () => {
  const both = cssRule({
    selectors: [".action", ".frame .action"],
    changedComponentPaths: ["action"],
    pageSelectors: [".frame .action"],
  });
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [both])], ACTION)[0]?.outcomes,
    [
      { lead: COPY.componentStyles, selectors: [".action", ".frame .action"] },
      { lead: COPY.viewOutside, selectors: [".frame .action"] },
    ],
  );
});

test("a saved view's unresolved page reason uses saved-view wording", () => {
  const unnamed = cssRule({ status: "unresolved", selectors: [] });
  delete (unnamed as { ruleKey?: string }).ruleKey;
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [componentRule, toneRule])], ACTION)[0]
      ?.outcomes,
    [
      { lead: COPY.componentStyles, selectors: [".action"] },
      { lead: COPY.viewUnresolved, selectors: [".tone"] },
    ],
  );
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [unnamed])], ACTION)[0]?.outcomes,
    [{ lead: COPY.viewUnnamed, selectors: [] }],
  );
});

test("an unresolved rule that changed the component keeps component wording", () => {
  const own = cssRule({
    status: "unresolved",
    selectors: [".action"],
    changedComponentPaths: ["action"],
  });
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [own])], ACTION)[0]?.outcomes,
    [{ lead: COPY.componentUnresolved, selectors: [".action"] }],
  );
});

test("a consuming component keeps another component's styles as matched evidence", () => {
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [componentRule])], TOOLBAR)[0]
      ?.outcomes,
    [{ lead: COPY.componentStyles, selectors: [".action"] }],
  );
});

test("a rule matched on one view and unresolved on another keeps both paragraphs", () => {
  const merged = cssRule({
    status: "unresolved",
    selectors: [".heading"],
    pageSelectors: [".heading"],
  });
  assert.deepEqual(
    stylesheetEvidence([cssReason(RULES, [merged])], SCREEN)[0]?.outcomes,
    [
      { lead: COPY.screenStyles, selectors: [".heading"] },
      { lead: COPY.screenUnresolved, selectors: [".heading"] },
    ],
  );
});

test("each file appears once in path order and other evidence is a path alone", () => {
  const reasons: readonly EntryChangeReason[] = [
    { kind: "material" },
    { kind: "dependency", path: "mockups/logo.svg" },
    cssReason("mockups/z.css", [headingRule]),
    cssReason("mockups/a.css", [componentRule]),
  ];
  const evidence = stylesheetEvidence(reasons, SCREEN);
  assert.deepEqual(
    evidence.map((item) => item.path),
    ["mockups/a.css", "mockups/logo.svg", "mockups/z.css"],
  );
  assert.deepEqual(evidence[1]?.outcomes, []);
});

test("rule keys and changed component ids never reach the presentation", () => {
  const text = JSON.stringify(
    stylesheetEvidence(
      [cssReason(RULES, [outsideRule, componentRule, toneRule])],
      SCREEN,
    ),
  );
  for (const key of ["1", "2", "4"]) assert.ok(!text.includes(key.repeat(64)));
  assert.doesNotMatch(text, /"action"|ruleKey|changedComponentPaths/);
});
