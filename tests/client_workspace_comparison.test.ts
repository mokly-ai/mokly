import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ReviewResultV3 } from "../packages/viewer/dist/review/component_types.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ReviewResultV2 } from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

test("loaded v2 details merge with classification, deduplicate selectors and suppress retained exclusions", () => {
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
  assert.match(markup, /mockups\/logo.svg/);
  assert.match(markup, /Excluded content: chrome/);
  assert.doesNotMatch(markup, /Examined and excluded|Shared component changes/);
  assert.equal(markup.split("<h3>Comparison details</h3>").length - 1, 1);
  assert.equal(renderEvidence(data, parsed), markup);
});

test("historical v2 loaded evidence remains available when classification has no view slice", () => {
  const data = workspace();
  delete data.status;
  const loaded = comparison();
  const markup = renderEvidence(data, parseReviewResult(loaded));
  assert.doesNotMatch(markup, / hidden=/);
  assert.match(markup, /mockups\/logo.svg/);
  assert.doesNotMatch(markup, /Shared component changes/);
});

test("loaded comparisons for another screen cannot add evidence to the selected workspace", () => {
  const data = workspace();
  const loaded = comparison();
  loaded.screens = [{ ...loaded.screens[0]!, route: "screens/other.html" }];
  assert.doesNotMatch(renderEvidence(data, loaded), /mockups\/logo.svg/);
});

test("v3 workspace evidence uses its selected comparison and keeps excluded stylesheets separate", () => {
  const data = workspace();
  data.status = "Unmodified";
  data.comparison = componentComparison(
    ["entries/renderer.ts", "mockups/unused.css"],
    undefined,
    "mockups/unused.css",
  ).screens[0]!;
  const loaded = parseReviewResult(componentComparison(["entries/stale.ts"]));

  const markup = renderEvidence(data, loaded);
  assert.match(
    markup,
    /Changes to these files may affect this screen:<\/p><ul><li>entries\/renderer\.ts<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /entries\/stale\.ts/);
  assert.match(
    markup,
    /Examined and excluded:<\/p><ul><li>mockups\/unused\.css<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /Changed styles that apply to this screen/);
});

test("loaded v3 shared impact joins retained dependency paths once in sorted order", () => {
  const loaded = parseReviewResult(
    componentComparison(
      ["entries/alpha.ts", "entries/beta.ts"],
      "entries/beta.ts",
    ),
  );
  const markup = renderEvidence(workspace(), loaded);

  assert.match(
    markup,
    /Changes to these files may affect this screen:<\/p><ul><li>entries\/alpha\.ts<\/li><li>entries\/beta\.ts<\/li><\/ul>/,
  );
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
  sharedImpact: string[],
  reasonPath?: string,
  excludedCss?: string,
): ReviewResultV3 {
  const address = { id: "home", route: "screens/home.html", title: "Home" };
  return {
    schemaVersion: 3,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: [
      ...new Set([...sharedImpact, ...(reasonPath ? [reasonPath] : [])]),
    ].sort(),
    sharedImpact: [...sharedImpact].sort(),
    ignoredImpact: [],
    screens: [
      {
        ...address,
        before: address,
        after: address,
        state: "unchanged",
        dependencies: [],
        sharedImpact,
        views: (["mobile", "desktop"] as const).map((viewport) => ({
          viewport,
          colorScheme: "light",
          state: "unchanged" as const,
          beforePath: `snapshots/before/screens/home.${viewport}.html`,
          afterPath: `snapshots/after/screens/home.${viewport}.html`,
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

function comparison(): ReviewResultV2 {
  return {
    schemaVersion: 2,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: [
      "mockups/logo.svg",
      "mockups/shared.css",
      "mockups/unused.css",
    ],
    sharedImpact: ["mockups/logo.svg"],
    ignoredImpact: [],
    screens: [
      {
        id: "home",
        route: "screens/home.html",
        title: "Home",
        state: "changed",
        dependencies: [],
        sharedImpact: ["mockups/logo.svg"],
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
      dependencies: [],
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
