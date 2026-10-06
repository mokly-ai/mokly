import assert from "node:assert/strict";
import test from "node:test";

import {
  changedViews,
  viewStates,
  viewStatesBySelection,
} from "../packages/viewer/dist/shell/workspace_views_data.js";
import type { ShellEvidence } from "../packages/viewer/src/shell/metadata.js";
import {
  componentReviewFixture,
  screenReviewFixture,
  shellEvidenceFixture,
} from "../packages/viewer/tests/manifest_path_fixture.js";
import {
  baselineManifestFixture,
  currentManifestEntryFixture,
} from "../packages/viewer/tests/manifest_path_fixture.js";
import { typedReviewFixture } from "../packages/viewer/tests/path_fixture.js";

import { DARK_VIEWS, context } from "./helpers/workspace_view_context.js";
import {
  component,
  componentBaseline,
  componentVariantResult,
  darkOnlyResult,
  screen,
  screenManifest,
} from "./helpers/workspace_views_data_fixture.js";

test("a ready comparison names the views it marked changed", () => {
  const result = darkOnlyResult("changed");
  assert.deepEqual(
    changedViews(
      currentManifestEntryFixture(screen),
      context({
        baseline: baselineManifestFixture(screenManifest),
        result: typedReviewFixture(result),
      }),
      {
        ...screenReviewFixture(result.screens[0]!),
      },
    ),
    DARK_VIEWS,
  );
});

test("a v4 component result keys every saved variant's view states", () => {
  const result = componentVariantResult();
  const comparison = result.components[0];
  assert.ok(comparison);
  const evidence = viewStatesBySelection(
    currentManifestEntryFixture(component),
    context({
      baseline: baselineManifestFixture(componentBaseline),
      result: typedReviewFixture(result),
    }),
    componentReviewFixture(comparison),
  );

  assert.deepEqual(Object.keys(evidence), [
    "badge/default",
    "badge/second",
    "badge/removed",
  ]);
  assert.deepEqual(
    evidence["badge/second"],
    comparison.variants
      .find(({ path }) => path === "badge/second")
      ?.views.map(({ colorScheme, state, viewport }) => ({
        colorScheme,
        state,
        viewport,
      })),
  );
  assert.deepEqual(
    viewStates(
      currentManifestEntryFixture(component),
      context({
        baseline: baselineManifestFixture(componentBaseline),
        result: typedReviewFixture(result),
      }),
      componentReviewFixture(comparison),
      "badge/default",
    ),
    evidence["badge/default"],
  );
});

test("lightweight screen-view evidence names the same views", () => {
  const evidence = {
    baseline: screenManifest,
    screenViews: [
      {
        path: screen.path,
        views: [
          { viewport: "desktop", colorScheme: "dark", state: "changed" },
          { viewport: "mobile", colorScheme: "light", state: "unchanged" },
          { viewport: "mobile", colorScheme: "dark", state: "changed" },
          { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        ],
      },
    ],
  } as ShellEvidence<string>;
  assert.deepEqual(
    changedViews(
      currentManifestEntryFixture(screen),
      context(shellEvidenceFixture(evidence!)),
      undefined,
    ),
    [...DARK_VIEWS],
  );
  assert.deepEqual(
    viewStates(
      currentManifestEntryFixture(screen),
      context(shellEvidenceFixture(evidence!)),
      undefined,
    ),
    [
      { viewport: "desktop", colorScheme: "dark", state: "changed" },
      { viewport: "mobile", colorScheme: "light", state: "unchanged" },
      { viewport: "mobile", colorScheme: "dark", state: "changed" },
      { viewport: "desktop", colorScheme: "light", state: "unchanged" },
    ],
  );
  assert.deepEqual(
    viewStatesBySelection(
      currentManifestEntryFixture(screen),
      context(shellEvidenceFixture(evidence!)),
      undefined,
    ),
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
        path: screen.path,
        views: [
          { viewport: "mobile", colorScheme: "light", state: "added" },
          { viewport: "mobile", colorScheme: "dark", state: "ignored-only" },
          { viewport: "desktop", colorScheme: "light", state: "removed" },
        ],
      },
    ],
  } as ShellEvidence<string>;
  assert.deepEqual(
    changedViews(
      currentManifestEntryFixture(screen),
      context(shellEvidenceFixture(evidence!)),
      undefined,
    ),
    [
      { viewport: "mobile", colorScheme: "light" },
      { viewport: "desktop", colorScheme: "light" },
    ],
  );
});

test("unknown evidence leaves the changed views empty", () => {
  assert.deepEqual(
    changedViews(currentManifestEntryFixture(screen), context(), undefined),
    [],
  );
  assert.deepEqual(
    changedViews(
      currentManifestEntryFixture(screen),
      context({ baseline: baselineManifestFixture(screenManifest) }),
      undefined,
    ),
    [],
  );
  assert.equal(
    viewStates(currentManifestEntryFixture(screen), context(), undefined),
    undefined,
  );
  assert.deepEqual(
    {
      ...viewStatesBySelection(
        currentManifestEntryFixture(screen),
        context(),
        undefined,
      ),
    },
    {},
  );
});
