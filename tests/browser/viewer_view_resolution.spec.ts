import { expect, type Page } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { test } from "./browser_test.js";
import { awaitRoutedDetail, expectNoCompareModes } from "./comparison_ui.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import { openPanelTab, setFrames } from "./workspace_actions.js";

import type {} from "./viewer_harness.js";

const comparisonUrl = `mokly-viewer/diffs/generations/${"c".repeat(64)}/`;
let fixture: Awaited<ReturnType<typeof followupFixture>>;

test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

function readyCatalogue(): CatalogueReadModel {
  const source = structuredClone(fixture.index);
  const changes = {
    status: "ready" as const,
    kind: "unmodified" as const,
    included: false,
  };
  return {
    ...source,
    changesStatus: "ready",
    baseCommit: "b".repeat(40),
    comparisonUrl,
    screens: source.screens.map((entry) => ({ ...entry, changes })),
    pages: source.pages.map((entry) => ({ ...entry, changes })),
    useCases: source.useCases.map((entry) => ({ ...entry, changes })),
    components: source.components.map((entry) => ({ ...entry, changes })),
  };
}

async function openViewer(
  page: Page,
  id: string,
  index: CatalogueReadModel,
  defaultSelection: Record<string, unknown>,
) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  const source = JSON.stringify(index);
  await page.evaluate(
    ({ defaultSelection, id, source }) =>
      window.viewerHarness.start(id, {
        source: JSON.parse(source) as CatalogueReadModel,
        defaultSelection,
      }),
    { defaultSelection, id, source },
  );
}

test("Viewer resolves a light fallback before status, marks and eligibility", async ({
  page,
}) => {
  const catalogue = readyCatalogue();
  const screen = catalogue.screens.find(({ path }) => path === "home");
  if (!screen) throw new Error("Missing Viewer screen fixture");
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.colorSchemes = ["light"];
  screen.views = screen.views
    .filter(({ colorScheme }) => colorScheme === "light")
    .map((view) => ({
      ...view,
      comparison: {
        status: "ready" as const,
        kind:
          view.viewport === "mobile"
            ? ("unmodified" as const)
            : ("changed" as const),
        eligible: view.viewport !== "mobile",
      },
    }));

  await openViewer(page, "mixed", catalogue, {
    screenPath: screen.path,
    viewport: "mobile",
    colorScheme: "dark",
  });

  const root = page.locator("#mixed");
  // The wide canvas shows the frames that the Frames filter shows: the
  // Mobile frames, whose one view is the Light view that stands in for the
  // Dark selection.
  await setFrames(root, { mobile: true, desktop: false });
  await expect(root.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await awaitRoutedDetail(root, screen.path);
  await expectNoCompareModes(root);
  // The Desktop toggle hides the changed view and carries the mark; the
  // light-only screen's Dark toggle reads Light only and marks nothing.
  await openPanelTab(root, "Inspect");
  await expect(root.locator('[data-view-changed="scheme"]')).toBeHidden();
  await expect(root.locator('[data-view-changed="viewport"]')).toBeVisible();
  const dark = root.locator('[data-frames-toggle="dark"]');
  await expect(dark).toBeDisabled();
  await expect(root.locator("label", { has: dark })).toContainText(
    "Light only",
  );
  await expect(root.locator('[data-workspace-frame="mobile"]')).toHaveAttribute(
    "src",
    /home\/index\.mobile\.html$/,
  );
});

test("Viewer keeps an unknown saved variant comparison ineligible", async ({
  page,
}) => {
  const catalogue = readyCatalogue();
  const component = catalogue.components.find(({ path }) => path === "pane");
  if (!component) throw new Error("Missing Viewer component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };
  const variant = catalogue.components
    .filter((entry) => entry.variantOf === component.path)
    .find(({ path }) => path === "pane/default");
  if (!variant) throw new Error("Missing Viewer saved variant fixture");
  variant.comparison = { status: "unavailable" };
  variant.views = variant.views.map((view) => ({
    ...view,
    comparison: { status: "unavailable" as const },
  }));

  await openViewer(page, "unknown", catalogue, {
    screenPath: variant.path,
    viewport: "desktop",
  });

  const root = page.locator("#unknown");
  await expect(root.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await awaitRoutedDetail(root, variant.path);
  await expectNoCompareModes(root);
});
