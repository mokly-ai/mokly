import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ReviewResultV4 } from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

test("loaded comparison details merge with classification, deduplicate selectors and suppress retained exclusions", () => {
  const data = workspace();
  data.resourceEvidence = [
    {
      viewport: "mobile",
      colorScheme: "light",
      reasons: [
        {
          kind: "dependency",
          path: "mockups/shared.css",
          analysis: { status: "matched", selectors: [".auth"] },
        },
      ],
      excludedResources: [
        { path: "mockups/unused.css", reason: "no-matching-rule" },
      ],
    },
  ];
  const loaded = comparison();
  loaded.screens = [
    {
      ...loaded.screens[0]!,
      views: [
        {
          ...loaded.screens[0]!.views[0]!,
          ignoredIds: ["chrome"],
          reasons: [
            {
              kind: "dependency",
              path: "mockups/shared.css",
              analysis: {
                status: "unresolved",
                selectors: [".auth", ".global"],
              },
            },
            {
              kind: "dependency",
              path: "mockups/unused.css",
              analysis: { status: "matched", selectors: [".saved"] },
            },
          ],
        },
      ],
    },
  ];
  const parsed = parseReviewResult(loaded);
  const markup = renderEvidence(data, parsed);
  assert.match(markup, /Changed styles that apply to this screen:/);
  assert.match(markup, /This change can apply anywhere on the screen/);
  for (const selector of [".auth", ".global", ".saved"])
    assert.equal(markup.split(`>${selector}</code>`).length - 1, 1);
  assert.equal(markup.split("<li>mockups/shared.css</li>").length - 1, 1);
  assert.doesNotMatch(markup, /mockups\/logo\.svg/);
  assert.match(markup, /mockups\/shared\.css/);
  assert.match(markup, /Excluded content: chrome/);
  assert.doesNotMatch(markup, /Examined and excluded|Shared component changes/);
  assert.equal(markup.split("<h3>Comparison details</h3>").length - 1, 1);
  assert.equal(renderEvidence(data, parsed), markup);
});

test("loaded view reasons remain visible without classification, not legacy shared-impact paths", () => {
  const data = workspace();
  delete data.status;
  const loaded = comparison();
  loaded.changedPaths = ["mockups/loaded.svg", ...loaded.changedPaths];
  loaded.screens[0]!.views[0]!.reasons = [
    { kind: "dependency", path: "mockups/loaded.svg" },
  ];
  const markup = renderEvidence(data, parseReviewResult(loaded));
  assert.doesNotMatch(markup, / hidden=/);
  assert.match(markup, /mockups\/loaded\.svg/);
  assert.doesNotMatch(markup, /mockups\/logo\.svg/);
  assert.doesNotMatch(markup, /Shared component changes/);
});

test("loaded comparisons for another screen cannot add evidence to the selected workspace", () => {
  const data = workspace();
  const loaded = comparison();
  loaded.screens = [{ ...loaded.screens[0]!, route: "screens/other.html" }];
  assert.doesNotMatch(renderEvidence(data, loaded), /mockups\/logo.svg/);
});

function renderEvidence(
  data: WorkspaceData,
  loaded: ReturnType<typeof parseReviewResult>,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, { data, loaded }),
  );
}

function comparison(): ReviewResultV4 {
  return {
    schemaVersion: 4,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: [
      "mockups/logo.svg",
      "mockups/shared.css",
      "mockups/unused.css",
    ],
    ignoredImpact: [],
    screens: [
      {
        id: "home",
        route: "screens/home.html",
        title: "Home",
        state: "changed",
        views: [
          {
            viewport: "mobile",
            colorScheme: "light",
            state: "changed",
            ignoredIds: [],
            beforePath: "snapshots/before/home.html",
            afterPath: "snapshots/after/home.html",
          },
        ],
      },
    ],
  };
}

function workspace(): WorkspaceData {
  return {
    base: "main",
    changedViews: { home: [] },
    viewStates: {},
    status: "Changed",
    comparisons: true,
    comparisonEligible: true,
    entry: {
      id: "home",
      kind: "screen",
      route: "screens/home.html",
      title: "Home",
      description: "Home",
      relatedDocs: [],
      navPath: [],
      sourcePath: "entries/home.mockup.tsx",
      useCaseIds: [],
      viewports: ["mobile", "desktop"],
      fragments: { mobile: "home-mobile.html", desktop: "home-desktop.html" },
    },
    components: [],
    views: [],
    variants: [],
    usedBy: [],
    affected: [],
    removed: false,
    relatedComponents: [],
    inputChanges: [],
  };
}
