import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { EntryChangeReason } from "../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";
import {
  excludedStylesheets,
  isStyleOnlyView,
  retainedPaths,
  styleOutcomes,
} from "../packages/viewer/dist/shell/workspace_style_evidence.js";

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
  const markup = renderEvidence({
    reasons: [
      {
        kind: "dependency",
        path: SHARED,
        analysis: { status: "matched", selectors: [".auth", "main a"] },
      },
    ],
  });

  assert.ok(
    markup.includes(
      "<p>Changes to these files may affect this screen:</p>" +
        `<ul><li>${SHARED}</li></ul>` +
        "<p>Changed styles that apply to this screen:</p>" +
        '<ul><li><code class="mbk-code">.auth</code></li>' +
        '<li><code class="mbk-code">main a</code></li></ul>',
    ),
  );
});

test("unresolved evidence says the change can apply anywhere", () => {
  const markup = renderEvidence({
    reasons: [
      {
        kind: "dependency",
        path: SHARED,
        analysis: { status: "unresolved", selectors: [":root"] },
      },
    ],
  });

  assert.ok(
    markup.includes(
      "<p>This change can apply anywhere on the screen, so the screen stays in Changes:</p>" +
        '<ul><li><code class="mbk-code">:root</code></li></ul>',
    ),
  );
});

test("an unresolved outcome without selectors closes with a full stop", () => {
  const markup = renderEvidence({
    reasons: [
      {
        kind: "dependency",
        path: SHARED,
        analysis: { status: "unresolved", selectors: [] },
      },
    ],
  });

  assert.match(
    markup,
    /<p>This change can apply anywhere on the screen, so the screen stays in Changes\.<\/p>/,
  );
});

test("excluded stylesheets lead with the outcome and pluralize sensibly", () => {
  const one = renderEvidence({ excluded: [SHARED] });
  assert.ok(
    one.includes(
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
        "<p>Examined and excluded:</p>" +
        `<ul><li>${SHARED}</li></ul>`,
    ),
  );

  const many = renderEvidence({ excluded: [SHARED, TOKENS] });
  assert.ok(
    many.includes(
      "<p>These stylesheets changed, but none of the changed styles apply to this screen.</p>" +
        "<p>Examined and excluded:</p>" +
        `<ul><li>${SHARED}</li><li>${TOKENS}</li></ul>`,
    ),
  );

  const none = renderEvidence({});
  assert.doesNotMatch(none, /stylesheets? changed|Examined and excluded/);
});

function renderEvidence({
  excluded = [],
  reasons = [],
}: {
  excluded?: readonly string[];
  reasons?: readonly EntryChangeReason[];
}): string {
  const data = {
    base: "main",
    status: "Changed",
    change: {
      kind: "screen",
      after: { id: "home", route: "screens/home.html", title: "Home" },
      reasons,
    },
    components: [],
    comparisonEligible: true,
    comparisons: true,
    entry: { id: "home", kind: "screen", route: "screens/home.html" },
    inputChanges: [],
    relatedComponents: [],
    resourceEvidence: excluded.length
      ? [
          {
            colorScheme: "light",
            excludedResources: excluded.map((path) => ({
              path,
              reason: "no-matching-rule" as const,
            })),
            viewport: "mobile",
          },
        ]
      : [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;
  return renderToStaticMarkup(createElement(WorkspaceEvidence, { data }));
}
