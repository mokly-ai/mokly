import assert from "node:assert/strict";
import test from "node:test";

import {
  appendChangedFiles,
  appendExcludedStylesheets,
  appendStyleOutcomes,
  excludedStylesheets,
  isStyleOnlyView,
  retainedPaths,
  styleOutcomes,
} from "../packages/viewer/dist/client/style_evidence.js";
import type { EntryChangeReason } from "../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../packages/viewer/dist/review/types.js";

import type { FakeMarkupElement } from "./helpers/fake_markup.js";
import { FakeMarkupDocument, fakeMarkup } from "./helpers/fake_markup.js";

const SHARED = "mockups/shared.css";
const TOKENS = "mockups/tokens.css";

test("analysed reasons group into one list per retained outcome", () => {
  const outcomes = styleOutcomes([
    { kind: "material" },
    { kind: "dependency", path: "mockups/logo.svg" },
    {
      kind: "dependency",
      path: SHARED,
      analysis: { status: "matched", selectors: ["main a", ".auth"] },
    },
    {
      kind: "dependency",
      path: TOKENS,
      analysis: { status: "matched", selectors: [".auth"] },
    },
    {
      kind: "dependency",
      path: "mockups/root.css",
      analysis: { status: "unresolved", selectors: [":root"] },
    },
  ]);

  assert.deepEqual(outcomes, [
    { status: "matched", selectors: [".auth", "main a"] },
    { status: "unresolved", selectors: [":root"] },
  ]);
  assert.deepEqual(styleOutcomes(undefined), []);
});

test("retained paths keep every changed dependency once, in order", () => {
  const reasons: readonly EntryChangeReason[] = [
    { kind: "screen", route: "screens/home.html" },
    { kind: "dependency", path: SHARED },
    { kind: "dependency", path: "mockups/logo.svg" },
    { kind: "dependency", path: SHARED },
  ];

  assert.deepEqual(retainedPaths(reasons), [SHARED, "mockups/logo.svg"]);
  assert.deepEqual(retainedPaths(undefined), []);
});

test("a stylesheet retained by any view is never also listed as excluded", () => {
  const views: readonly ViewReview[] = [
    {
      colorScheme: "light",
      ignoredIds: [],
      state: "changed",
      viewport: "mobile",
      reasons: [
        {
          kind: "dependency",
          path: SHARED,
          analysis: { status: "matched", selectors: [".auth"] },
        },
      ],
    },
    {
      colorScheme: "dark",
      ignoredIds: [],
      state: "unchanged",
      viewport: "mobile",
      excludedResources: [
        { path: SHARED, reason: "no-matching-rule" },
        { path: TOKENS, reason: "no-matching-rule" },
      ],
    },
    {
      colorScheme: "light",
      ignoredIds: [],
      state: "unchanged",
      viewport: "desktop",
      excludedResources: [
        { path: "mockups/a.css", reason: "no-matching-rule" },
      ],
    },
  ];

  assert.deepEqual(excludedStylesheets(views, []), ["mockups/a.css", TOKENS]);
  assert.deepEqual(excludedStylesheets(views, [TOKENS]), ["mockups/a.css"]);
  assert.deepEqual(excludedStylesheets([], []), []);
});

test("only a changed view kept solely by stylesheet analysis reads as styles", () => {
  const base = {
    colorScheme: "light",
    ignoredIds: [],
    viewport: "mobile",
  } as const;
  const analysed = {
    kind: "dependency",
    path: SHARED,
    analysis: { status: "matched", selectors: [".auth"] },
  } as const;

  assert.equal(
    isStyleOnlyView({ ...base, state: "changed", reasons: [analysed] }),
    true,
  );
  assert.equal(
    isStyleOnlyView({
      ...base,
      state: "changed",
      reasons: [analysed, { kind: "dependency", path: "mockups/logo.svg" }],
    }),
    false,
  );
  assert.equal(isStyleOnlyView({ ...base, state: "changed" }), false);
  assert.equal(
    isStyleOnlyView({
      ...base,
      state: "unchanged",
      excludedResources: [{ path: SHARED, reason: "no-matching-rule" }],
    }),
    false,
  );
});

test("matched evidence names the changed files and then the applying styles", () => {
  const { doc, node, panel } = fakePanel();

  appendChangedFiles(doc, panel, [SHARED]);
  appendStyleOutcomes(doc, panel, [
    { status: "matched", selectors: [".auth", "main a"] },
  ]);

  assert.equal(
    fakeMarkup(node),
    "<p>Changes to these files may affect this screen:</p>" +
      `<ul><li>${SHARED}</li></ul>` +
      "<p>Changed styles that apply to this screen:</p>" +
      '<ul><li><code class="mbk-code">.auth</code></li>' +
      '<li><code class="mbk-code">main a</code></li></ul>',
  );
});

test("unresolved evidence says the change can apply anywhere", () => {
  const { doc, node, panel } = fakePanel();

  appendStyleOutcomes(doc, panel, [
    { status: "unresolved", selectors: [":root"] },
  ]);

  assert.equal(
    fakeMarkup(node),
    "<p>This change can apply anywhere on the screen, so the screen stays in Changes:</p>" +
      '<ul><li><code class="mbk-code">:root</code></li></ul>',
  );
});

test("an unresolved outcome without selectors closes with a full stop", () => {
  const { doc, node, panel } = fakePanel();

  appendStyleOutcomes(doc, panel, [{ status: "unresolved", selectors: [] }]);

  assert.equal(
    fakeMarkup(node),
    "<p>This change can apply anywhere on the screen, so the screen stays in Changes.</p>",
  );
});

test("excluded stylesheets lead with the outcome and pluralize sensibly", () => {
  const one = fakePanel();
  appendExcludedStylesheets(one.doc, one.panel, [SHARED]);
  assert.equal(
    fakeMarkup(one.node),
    "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p>" +
      `<ul><li>${SHARED}</li></ul>`,
  );

  const many = fakePanel();
  appendExcludedStylesheets(many.doc, many.panel, [SHARED, TOKENS]);
  assert.equal(
    fakeMarkup(many.node),
    "<p>These stylesheets changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p>" +
      `<ul><li>${SHARED}</li><li>${TOKENS}</li></ul>`,
  );

  const none = fakePanel();
  appendExcludedStylesheets(none.doc, none.panel, []);
  assert.equal(fakeMarkup(none.node), "");
});

function fakePanel(): {
  doc: Document;
  node: FakeMarkupElement;
  panel: Element;
} {
  const document = new FakeMarkupDocument();
  const node = document.createElement("section");
  return {
    doc: document as unknown as Document,
    node,
    panel: node as unknown as Element,
  };
}
