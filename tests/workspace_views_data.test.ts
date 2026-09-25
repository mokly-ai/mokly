import assert from "node:assert/strict";
import test from "node:test";

import { viewPage } from "../dist/server/pages.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import {
  changedViews,
  viewStates,
  viewStatesBySelection,
} from "../packages/viewer/dist/shell/workspace_views_data.js";

import { attribute, documentElements } from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";
import {
  component,
  componentBaseline,
  componentManifest,
  componentVariantResult,
  darkOnlyResult,
  screen,
  screenManifest,
} from "./helpers/workspace_views_data_fixture.js";

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
    changedViews(screen, context({ baseline: screenManifest, result }), {
      ...result.screens[0]!,
    }),
    DARK_VIEWS,
  );
});

test("a v5 component result keys every saved variant's view states", () => {
  const result = componentVariantResult();
  const comparison = result.components[0];
  assert.ok(comparison);
  const evidence = viewStatesBySelection(
    component,
    context({ baseline: componentBaseline, result }),
    comparison,
  );

  assert.deepEqual(Object.keys(evidence), ["default", "second", "removed"]);
  assert.deepEqual(
    evidence.second,
    comparison.variants
      .find(({ id }) => id === "second")
      ?.views.map(({ colorScheme, state, viewport }) => ({
        colorScheme,
        state,
        viewport,
      })),
  );
  assert.deepEqual(
    viewStates(
      component,
      context({ baseline: componentBaseline, result }),
      comparison,
      "default",
    ),
    evidence.default,
  );
});

test("lightweight screen-view evidence names the same views", () => {
  const evidence = {
    baseline: screenManifest,
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
  assert.deepEqual(viewStates(screen, context(evidence), undefined), [
    { viewport: "desktop", colorScheme: "dark", state: "changed" },
    { viewport: "mobile", colorScheme: "light", state: "unchanged" },
    { viewport: "mobile", colorScheme: "dark", state: "changed" },
    { viewport: "desktop", colorScheme: "light", state: "unchanged" },
  ]);
  assert.deepEqual(
    viewStatesBySelection(screen, context(evidence), undefined),
    {
      welcome: [
        { viewport: "desktop", colorScheme: "dark", state: "changed" },
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "changed" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
      ],
    },
  );
});

test("added and removed views count as changed views", () => {
  const evidence = {
    baseline: screenManifest,
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
    changedViews(screen, context({ baseline: screenManifest }), undefined),
    [],
  );
  assert.equal(viewStates(screen, context(), undefined), undefined);
  assert.deepEqual(viewStatesBySelection(screen, context(), undefined), {});
});

test("workspace data publishes one changed-view list for a screen", () => {
  const result = darkOnlyResult("changed");
  const catalogue = createCatalogue(screenManifest);
  const data = workspaceData(
    catalogue,
    context({ baseline: screenManifest, result }),
    screen,
  );
  assert.deepEqual(data.changedViews, { welcome: DARK_VIEWS });
  assert.deepEqual(
    data.viewStates.welcome,
    result.screens[0]?.views.map(({ colorScheme, state, viewport }) => ({
      colorScheme,
      state,
      viewport,
    })),
  );
  assert.equal(data.status, "Changed");
  const unknown = workspaceData(catalogue, context(), screen);
  assert.deepEqual(unknown.changedViews, { welcome: [] });
  assert.deepEqual(unknown.viewStates, {});
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
  assert.deepEqual(
    data.viewStates,
    Object.fromEntries(
      result.components[0]!.variants.map(({ id, views }) => [
        id,
        views.map(({ colorScheme, state, viewport }) => ({
          colorScheme,
          state,
          viewport,
        })),
      ]),
    ),
  );
  assert.equal(
    data.variants.find(({ value }) => value.id === "removed")?.removed,
    true,
  );
});

test("standalone Appearance and details name a dark-only change", () => {
  const catalogue = createCatalogue(screenManifest);
  const shellContext = context({
    baseline: screenManifest,
    result: darkOnlyResult("unchanged"),
  });
  const html = viewPage(
    screen,
    catalogue,
    publicShellContext(catalogue, shellContext),
  );
  assert.match(html, /data-workspace-status="">Unmodified</);
  assert.equal(attribute(viewMark(html, "scheme"), "hidden"), undefined);
  assert.match(
    html,
    /<span class="mbk-view-changed-text" data-view-changed-text="scheme" id="mb-view-changed-scheme">Other theme changed<\/span>/,
  );
  assert.equal(
    attribute(
      shellControl(html, "data-mokly-appearance-select"),
      "aria-describedby",
    ),
    "mb-view-changed-scheme",
  );
  assert.doesNotMatch(html, /data-workspace-scheme/);
  assert.equal(attribute(viewMark(html, "viewport"), "hidden"), "");
  assert.doesNotMatch(html, /aria-describedby="mb-view-changed-viewport"/);
  assert.match(
    html,
    /<div class="mbk-meta-row" data-workspace-changed-views=""><span class="mbk-meta-k">Changed views<\/span><span class="mbk-meta-v" data-workspace-changed-views-value="">Mobile · Dark, Desktop · Dark<\/span><\/div>/,
  );
});

test("an unchanged screen hides every changed-view mark and row", () => {
  const catalogue = createCatalogue(screenManifest);
  const shellContext = context({ baseline: screenManifest });
  const html = viewPage(
    screen,
    catalogue,
    publicShellContext(catalogue, shellContext),
  );
  assert.equal(attribute(viewMark(html, "scheme"), "hidden"), "");
  assert.doesNotMatch(html, /aria-describedby="mb-view-changed-/);
  assert.match(html, /data-workspace-changed-views="" hidden=""/);
  assert.doesNotMatch(html, /Mobile · Dark/);
});

function viewMark(html: string, kind: "scheme" | "viewport") {
  const marks = documentElements(
    html,
    (element) => attribute(element, "data-view-changed") === kind,
  );
  assert.equal(marks.length, 1);
  return marks[0]!;
}

function shellControl(html: string, name: string) {
  const controls = documentElements(
    html,
    (element) => attribute(element, name) !== undefined,
  );
  assert.equal(controls.length, 1);
  return controls[0]!;
}
