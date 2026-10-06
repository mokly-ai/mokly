import assert from "node:assert/strict";
import test from "node:test";

import { removedManifestEntries } from "../dist/registry/changes.js";
import { viewPage } from "../dist/server/pages.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import {
  baselineManifestFixture,
  currentManifestEntryFixture,
} from "../packages/viewer/tests/manifest_path_fixture.js";
import { typedReviewFixture } from "../packages/viewer/tests/path_fixture.js";

import { attribute, documentElements } from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";
import { DARK_VIEWS, context } from "./helpers/workspace_view_context.js";
import {
  component,
  componentBaseline,
  componentManifest,
  componentVariantResult,
  darkOnlyResult,
  screen,
  screenManifest,
} from "./helpers/workspace_views_data_fixture.js";

test("workspace data publishes one changed-view list for a screen", () => {
  const result = darkOnlyResult("changed");
  const catalogue = createCatalogue(screenManifest);
  const data = workspaceData(
    catalogue,
    context({
      baseline: baselineManifestFixture(screenManifest),
      result: typedReviewFixture(result),
    }),
    currentManifestEntryFixture(screen),
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
  const unknown = workspaceData(
    catalogue,
    context(),
    currentManifestEntryFixture(screen),
  );
  assert.deepEqual(unknown.changedViews, { welcome: [] });
  assert.deepEqual({ ...unknown.viewStates }, {});
});

test("workspace data keeps changed views with current and removed variants", () => {
  const result = componentVariantResult();
  const data = workspaceData(
    createCatalogue(
      componentManifest,
      removedManifestEntries(componentManifest, componentBaseline),
    ),
    {
      base: "main",
      componentChanges: {
        baseline: baselineManifestFixture(componentBaseline),
        result: typedReviewFixture(result),
      },
      updateVersion: 1,
    },
    currentManifestEntryFixture(component),
  );

  assert.deepEqual(data.changedViews, {
    "badge/default": [],
    "badge/second": DARK_VIEWS,
    "badge/removed": [
      { viewport: "mobile", colorScheme: "light" },
      { viewport: "mobile", colorScheme: "dark" },
      { viewport: "desktop", colorScheme: "light" },
      { viewport: "desktop", colorScheme: "dark" },
    ],
  });
  assert.deepEqual(
    { ...data.viewStates },
    Object.fromEntries(
      result.components[0]!.variants.map(({ path, views }) => [
        path,
        views.map(({ colorScheme, state, viewport }) => ({
          colorScheme,
          state,
          viewport,
        })),
      ]),
    ),
  );
  assert.equal(
    data.variants.find(({ value }) => value.path === "badge/removed")?.removed,
    true,
  );
});

test("standalone Appearance and details name a dark-only change", () => {
  const catalogue = createCatalogue(screenManifest);
  const shellContext = context({
    baseline: baselineManifestFixture(screenManifest),
    result: typedReviewFixture(darkOnlyResult("unchanged")),
  });
  const html = viewPage(
    currentManifestEntryFixture(screen),
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
  const shellContext = context({
    baseline: baselineManifestFixture(screenManifest),
  });
  const html = viewPage(
    currentManifestEntryFixture(screen),
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
