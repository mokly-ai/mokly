import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ReviewResultV6 } from "../packages/viewer/dist/review/component_types.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

import {
  cssReason,
  cssRule,
  fixtureCssAnalysis,
} from "./helpers/css_evidence.js";

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
          analysis: fixtureCssAnalysis("matched", [".auth"]),
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
            cssReason("mockups/shared.css", [
              cssRule({
                ruleKey: "a".repeat(64),
                selectors: [".auth"],
                pageSelectors: [".auth"],
              }),
              cssRule({
                ruleKey: "c".repeat(64),
                status: "unresolved",
                selectors: [".global"],
              }),
            ]),
            {
              kind: "dependency",
              path: "mockups/unused.css",
              analysis: fixtureCssAnalysis("matched", [".saved"]),
            },
          ],
        },
      ],
    },
  ];
  loaded.ignoredImpact = [
    {
      viewport: "mobile",
      colorScheme: "light",
      id: "chrome",
      count: 1,
    },
  ];
  const parsed = parseReviewResult(loaded);
  const markup = renderEvidence(data, parsed);
  assert.match(markup, /Changed styles that apply to this screen:/);
  assert.match(markup, /This change can apply anywhere on the screen/);
  for (const selector of [".auth", ".global", ".saved"])
    assert.equal(markup.split(`>${selector}</code>`).length - 1, 1);
  assert.equal(markup.split("<li>mockups/shared.css<p>").length - 1, 1);
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
  loaded.screens = [{ ...loaded.screens[0]!, path: "other" }];
  assert.doesNotMatch(renderEvidence(data, loaded), /mockups\/logo.svg/);
});

test("v5 workspace evidence omits source-only paths and keeps excluded stylesheets separate", () => {
  const data = workspace();
  data.status = "Unmodified";
  data.comparison = componentComparison(
    ["entries/renderer.ts", "mockups/unused.css"],
    undefined,
    "mockups/unused.css",
  ).screens[0]!;
  const loaded = parseReviewResult(componentComparison(["entries/stale.ts"]));

  const markup = renderEvidence(data, loaded);
  assert.doesNotMatch(markup, /Changes to these files may affect this screen:/);
  assert.doesNotMatch(markup, /entries\/renderer\.ts/);
  assert.doesNotMatch(markup, /entries\/stale\.ts/);
  assert.match(
    markup,
    /Examined and excluded:<\/p><ul><li>mockups\/unused\.css<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /Changed styles that apply to this screen/);
});

test("loaded v5 evidence omits source-only paths and deduplicates retained resources", () => {
  const loaded = parseReviewResult(
    componentComparison(
      ["entries/alpha.ts", "entries/beta.ts"],
      "entries/beta.ts",
    ),
  );
  const markup = renderEvidence(workspace(), loaded);

  assert.match(
    markup,
    /Changes to these files may affect this screen:<\/p><ul class="mbk-evidence-files"><li>entries\/beta\.ts<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /entries\/alpha\.ts/);
  assert.equal(markup.split("<li>entries/beta.ts</li>").length - 1, 1);
});

function renderEvidence(
  data: WorkspaceData,
  loaded?: ReturnType<typeof parseReviewResult>,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(loaded ? { loaded } : {}),
    }),
  );
}

function componentComparison(
  sourcePaths: string[],
  reasonPath?: string,
  excludedCss?: string,
): ReviewResultV6 {
  const address = { path: "home", title: "Home" };
  return {
    schemaVersion: 6 as const,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: [
      ...new Set([...sourcePaths, ...(reasonPath ? [reasonPath] : [])]),
    ].sort(),

    ignoredImpact: [],
    screens: [
      {
        ...address,
        before: address,
        after: address,
        state: "unchanged",

        views: (["mobile", "desktop"] as const).map((viewport) => ({
          viewport,
          colorScheme: "light",
          state: "unchanged" as const,
          ignoredIds: [],
          ...(excludedCss
            ? {
                excludedResources: [
                  { path: excludedCss, reason: "no-matching-rule" as const },
                ],
              }
            : {}),
        })),
      },
    ],
    components: [],
    changes: reasonPath
      ? [
          {
            kind: "screen",
            before: address,
            after: address,
            reasons: [{ kind: "dependency", path: reasonPath }],
          },
        ]
      : [],
    affectedConsumers: [],
  };
}

function comparison(): ReviewResultV6 {
  return {
    schemaVersion: 6 as const,
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
        before: { path: "home", title: "Home" },
        after: { path: "home", title: "Home" },
        path: "home",
        title: "Home",
        state: "changed",
        views: [
          {
            viewport: "mobile",
            colorScheme: "light",
            state: "changed",
            ignoredIds: [],
          },
        ],
      },
    ],
    components: [],
    changes: [],
    affectedConsumers: [],
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
      colorSchemes: ["light"],
      path: "home",
      kind: "screen",
      title: "Home",
      description: "Home",
      relatedDocs: [],

      sourcePath: "entries/home.mockup.tsx",
      useCasePaths: [],
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
