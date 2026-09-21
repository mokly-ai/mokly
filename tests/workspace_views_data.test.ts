import assert from "node:assert/strict";
import test from "node:test";

import { viewPage } from "../dist/server/pages.js";
import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";
import type { ReviewResultV3 } from "../packages/viewer/dist/review/component_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { changedViews } from "../packages/viewer/dist/shell/workspace_views_data.js";

import {
  component,
  componentBaseline,
  componentManifest,
  componentVariantResult,
} from "./helpers/workspace_views_data_fixture.js";

const screen = {
  darkFragments: {
    desktop: "screens/welcome.desktop.dark.html",
    mobile: "screens/welcome.mobile.dark.html",
  },
  declaredDependencies: [],
  dependencies: [],
  description: "Landing screen",
  fragments: {
    desktop: "screens/welcome.desktop.html",
    mobile: "screens/welcome.mobile.html",
  },
  id: "welcome",
  kind: "screen",
  navPath: [],
  relatedDocs: [],
  route: "screens/welcome.html",
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Welcome",
  useCaseIds: [],
  viewports: ["mobile", "desktop"],
} as const;

const manifest: ManifestV5 = {
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 5,
  sourceFiles: ["entries/fixture.mockup.tsx"],
};

/**
 * A v3 comparison whose only material difference is in the dark renders. The
 * screen's own state is a parameter because a shared component can change a
 * view without giving the screen an independent entry in Changes.
 */
function darkOnlyResult(state: "changed" | "unchanged"): ReviewResultV3 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["mockups/styles.css"],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 3,
    screens: [
      {
        dependencies: [],
        id: "welcome",
        route: "screens/welcome.html",
        sharedImpact: [],
        state,
        title: "Welcome",
        views: [
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            viewport: "mobile",
          },
          {
            colorScheme: "dark",
            ignoredIds: [],
            state: "changed",
            viewport: "mobile",
          },
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            viewport: "desktop",
          },
          {
            colorScheme: "dark",
            ignoredIds: [],
            state: "changed",
            viewport: "desktop",
          },
        ],
      },
    ],
    sharedImpact: [],
  };
}

const DARK_VIEWS = [
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "dark" },
];

function context(evidence?: ShellContext["componentChanges"]): ShellContext {
  return {
    base: "main",
    updateVersion: 1,
    activeRoute: screen.route,
    ...(evidence ? { componentChanges: evidence } : {}),
  };
}

test("a ready comparison names the views it marked changed", () => {
  const result = darkOnlyResult("changed");
  assert.deepEqual(
    changedViews(screen, context({ baseline: manifest, result }), {
      ...result.screens[0]!,
    }),
    DARK_VIEWS,
  );
});

test("lightweight screen-view evidence names the same views", () => {
  const evidence = {
    baseline: manifest,
    screenViews: [
      {
        route: screen.route,
        views: [
          { viewport: "desktop", colorScheme: "dark", state: "changed" },
          { viewport: "mobile", colorScheme: "light", state: "unchanged" },
          { viewport: "mobile", colorScheme: "dark", state: "changed" },
          { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        ],
      },
    ],
  } as ShellContext["componentChanges"];
  assert.deepEqual(changedViews(screen, context(evidence), undefined), [
    ...DARK_VIEWS,
  ]);
});

test("added and removed views count as changed views", () => {
  const evidence = {
    baseline: manifest,
    screenViews: [
      {
        route: screen.route,
        views: [
          { viewport: "mobile", colorScheme: "light", state: "added" },
          { viewport: "mobile", colorScheme: "dark", state: "ignored-only" },
          { viewport: "desktop", colorScheme: "light", state: "removed" },
        ],
      },
    ],
  } as ShellContext["componentChanges"];
  assert.deepEqual(changedViews(screen, context(evidence), undefined), [
    { viewport: "mobile", colorScheme: "light" },
    { viewport: "desktop", colorScheme: "light" },
  ]);
});

test("unknown evidence leaves the changed views empty", () => {
  assert.deepEqual(changedViews(screen, context(), undefined), []);
  assert.deepEqual(
    changedViews(screen, context({ baseline: manifest }), undefined),
    [],
  );
});

test("workspace data publishes one changed-view list for a screen", () => {
  const result = darkOnlyResult("changed");
  const catalogue = createCatalogue(manifest);
  const data = workspaceData(
    catalogue,
    context({ baseline: manifest, result }),
    screen,
  );
  assert.deepEqual(data.changedViews, { welcome: DARK_VIEWS });
  assert.equal(data.status, "Changed");
  assert.deepEqual(workspaceData(catalogue, context(), screen).changedViews, {
    welcome: [],
  });
});

test("workspace data keeps changed views with current and removed variants", () => {
  const result = componentVariantResult();
  const data = workspaceData(
    createCatalogue(componentManifest),
    {
      base: "main",
      componentChanges: { baseline: componentBaseline, result },
      updateVersion: 1,
    },
    component,
  );

  assert.deepEqual(data.changedViews, {
    default: [],
    second: DARK_VIEWS,
    removed: [
      { viewport: "mobile", colorScheme: "light" },
      { viewport: "mobile", colorScheme: "dark" },
      { viewport: "desktop", colorScheme: "light" },
      { viewport: "desktop", colorScheme: "dark" },
    ],
  });
  assert.equal(
    data.variants.find(({ value }) => value.id === "removed")?.removed,
    true,
  );
});

test("the view controls and details name a dark-only change", () => {
  const catalogue = createCatalogue(manifest);
  const html = viewPage(
    screen,
    catalogue,
    context({ baseline: manifest, result: darkOnlyResult("unchanged") }),
  );
  assert.match(html, /data-workspace-status="">Unmodified</);
  assert.match(
    html,
    /<span class="mbk-view-changed" aria-hidden="true" data-view-changed="scheme"><\/span>/,
  );
  assert.match(
    html,
    /<span class="mbk-view-changed-text" data-view-changed-text="scheme" id="mb-view-changed-scheme">Other theme changed<\/span>/,
  );
  assert.match(
    html,
    /data-workspace-scheme="" aria-describedby="mb-view-changed-scheme"/,
  );
  assert.match(
    html,
    /<span class="mbk-view-changed" aria-hidden="true" data-view-changed="viewport" hidden=""><\/span>/,
  );
  assert.doesNotMatch(html, /aria-describedby="mb-view-changed-viewport"/);
  assert.match(
    html,
    /<div class="mbk-meta-row" data-workspace-changed-views=""><span class="mbk-meta-k">Changed views<\/span><span class="mbk-meta-v" data-workspace-changed-views-value="">Mobile · Dark, Desktop · Dark<\/span><\/div>/,
  );
});

test("an unchanged screen hides every changed-view mark and row", () => {
  const catalogue = createCatalogue(manifest);
  const html = viewPage(screen, catalogue, context({ baseline: manifest }));
  assert.match(
    html,
    /<span class="mbk-view-changed" aria-hidden="true" data-view-changed="scheme" hidden=""><\/span>/,
  );
  assert.doesNotMatch(html, /aria-describedby="mb-view-changed-/);
  assert.match(html, /data-workspace-changed-views="" hidden=""/);
  assert.doesNotMatch(html, /Mobile · Dark/);
});
