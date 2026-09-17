import assert from "node:assert/strict";
import test from "node:test";

import { renderWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_evidence.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ReviewResultV2 } from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { FakeMarkupDocument, fakeMarkup } from "./helpers/fake_markup.js";

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
  const node = new FakeMarkupDocument().createElement("section");
  const parsed = parseReviewResult(loaded);
  renderWorkspaceEvidence(
    node as unknown as HTMLElement,
    data,
    undefined,
    parsed,
  );
  const markup = fakeMarkup(node);
  assert.match(markup, /Changed styles that apply to this screen:/);
  assert.match(markup, /This change can apply anywhere on the screen/);
  for (const selector of [".auth", ".global", ".saved"])
    assert.equal(markup.split(`>${selector}</code>`).length - 1, 1);
  assert.equal(markup.split("<li>mockups/shared.css</li>").length - 1, 1);
  assert.match(markup, /mockups\/logo.svg/);
  assert.match(markup, /Excluded content: chrome/);
  assert.doesNotMatch(markup, /Examined and excluded|Shared component changes/);
  assert.equal(markup.split("<h3>Comparison details</h3>").length - 1, 1);
  renderWorkspaceEvidence(
    node as unknown as HTMLElement,
    data,
    undefined,
    parsed,
  );
  assert.equal(fakeMarkup(node), markup);
});

test("historical v2 loaded evidence remains available when classification has no view slice", () => {
  const data = workspace();
  delete data.status;
  const loaded = comparison();
  const node = new FakeMarkupDocument().createElement("section");
  renderWorkspaceEvidence(
    node as unknown as HTMLElement,
    data,
    undefined,
    parseReviewResult(loaded),
  );
  assert.equal(node.hidden, false);
  assert.match(fakeMarkup(node), /mockups\/logo.svg/);
  assert.doesNotMatch(fakeMarkup(node), /Shared component changes/);
});

test("loaded comparisons for another screen cannot add evidence to the selected workspace", () => {
  const data = workspace();
  const loaded = comparison();
  loaded.screens = [{ ...loaded.screens[0]!, route: "screens/other.html" }];
  const node = new FakeMarkupDocument().createElement("section");
  renderWorkspaceEvidence(
    node as unknown as HTMLElement,
    data,
    undefined,
    loaded,
  );
  assert.doesNotMatch(fakeMarkup(node), /mockups\/logo.svg/);
});

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
