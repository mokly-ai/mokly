import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ChangeReason,
  ReviewView,
  ViewResourceEvidence,
} from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";
import {
  excludedStylesheets,
  isStyleOnlyView,
  retainedPaths,
} from "../packages/viewer/dist/shell/workspace_style_evidence.js";
import { stylesheetEvidence } from "../packages/viewer/dist/shell/workspace_stylesheet_evidence.js";

import { fixtureCssAnalysis } from "./helpers/css_evidence.js";

const SHARED = "mockups/shared.css";

/** A view's presented evidence, as the Details panel receives it. */
type PresentedView = ViewResourceEvidence & {
  ignoredIds: readonly string[];
  state: ReviewView["state"];
};
const TOKENS = "mockups/tokens.css";

test("analysed reasons keep one list per file, so no list mixes two stylesheets", () => {
  const evidence = stylesheetEvidence(
    [
      { kind: "material" },
      { kind: "dependency", path: "mockups/logo.svg" },
      {
        kind: "dependency",
        path: SHARED,
        analysis: fixtureCssAnalysis("matched", ["main a", ".auth"]),
      },
      {
        kind: "dependency",
        path: TOKENS,
        analysis: fixtureCssAnalysis("matched", [".auth"]),
      },
      {
        kind: "dependency",
        path: "mockups/root.css",
        analysis: fixtureCssAnalysis("unresolved", [":root"]),
      },
    ],
    { kind: "screen" },
  );

  const matched = "Changed styles that apply to this screen:";
  assert.deepEqual(evidence, [
    { path: "mockups/logo.svg", outcomes: [] },
    {
      path: "mockups/root.css",
      outcomes: [
        {
          lead: "This change can apply anywhere on the screen, so the screen stays in Changes:",
          selectors: [":root"],
        },
      ],
    },
    {
      path: SHARED,
      outcomes: [{ lead: matched, selectors: [".auth", "main a"] }],
    },
    { path: TOKENS, outcomes: [{ lead: matched, selectors: [".auth"] }] },
  ]);
  assert.deepEqual(stylesheetEvidence([], { kind: "screen" }), []);
});

test("retained paths keep every changed dependency once, in order", () => {
  const reasons: readonly ChangeReason[] = [
    { kind: "screen", screenPath: "home" },
    { kind: "dependency", path: SHARED },
    { kind: "dependency", path: "mockups/logo.svg" },
    { kind: "dependency", path: SHARED },
  ];

  assert.deepEqual(retainedPaths(reasons), [SHARED, "mockups/logo.svg"]);
  assert.deepEqual(retainedPaths(undefined), []);
});

test("a stylesheet retained by any view is never also listed as excluded", () => {
  const views: readonly PresentedView[] = [
    {
      colorScheme: "light",
      ignoredIds: [],
      state: "changed",
      viewport: "mobile",
      reasons: [
        {
          kind: "dependency",
          path: SHARED,
          analysis: fixtureCssAnalysis("matched", [".auth"]),
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

test("only a changed view whose every reason names a stylesheet ruled on it reads as styles", () => {
  const base: Pick<ReviewView, "colorScheme" | "ignoredIds" | "viewport"> = {
    colorScheme: "light",
    ignoredIds: [],
    viewport: "mobile",
  };
  const rule = {
    stylesheet: "static/mockups/shared.css",
    selector: ".auth",
    status: "matched",
    owner: { kind: "entry" },
  } as const;
  const changed: ReviewView = { ...base, state: "changed", rules: [rule] };
  const sheet = { kind: "dependency", path: rule.stylesheet } as const;
  const logo = "static/mockups/logo.svg";

  assert.equal(isStyleOnlyView(changed, [sheet]), true);
  assert.equal(
    isStyleOnlyView(
      { ...changed, resources: [{ path: logo, owner: { kind: "entry" } }] },
      [{ kind: "dependency", path: logo }, sheet],
    ),
    false,
  );
  assert.equal(isStyleOnlyView(changed, [sheet, { kind: "material" }]), false);
  assert.equal(isStyleOnlyView({ ...base, state: "changed" }, [sheet]), false);
  assert.equal(
    isStyleOnlyView(
      {
        ...base,
        state: "unchanged",
        rules: [{ ...rule, selector: "", status: "excluded" }],
      },
      [sheet],
    ),
    false,
  );
});

test("matched evidence names the changed files and then the applying styles", () => {
  const markup = renderEvidence({
    reasons: [
      {
        kind: "dependency",
        path: SHARED,
        analysis: fixtureCssAnalysis("matched", [".auth", "main a"]),
      },
    ],
  });

  assert.ok(
    markup.includes(
      "<p>Changes to these files may affect this screen:</p>" +
        `<ul class="mbk-evidence-files"><li>${SHARED}` +
        "<p>Changed styles that apply to this screen:</p>" +
        '<ul><li><code class="mbk-code">.auth</code></li>' +
        '<li><code class="mbk-code">main a</code></li></ul>' +
        "</li></ul>",
    ),
  );
});

test("unresolved evidence says the change can apply anywhere", () => {
  const markup = renderEvidence({
    reasons: [
      {
        kind: "dependency",
        path: SHARED,
        analysis: fixtureCssAnalysis("unresolved", [":root"]),
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
        analysis: fixtureCssAnalysis("unresolved", []),
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
  reasons?: readonly ChangeReason[];
}): string {
  const data = {
    base: "main",
    status: "Changed",
    change: {
      kind: "screen",
      after: { id: "home", route: "home/index.html", title: "Home" },
      reasons,
    },
    components: [],
    comparisonEligible: true,
    comparisons: true,
    entry: { id: "home", kind: "screen", route: "home/index.html" },
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
