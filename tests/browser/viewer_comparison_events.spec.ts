/**
 * An embedded viewer's comparison stays lazy until a mode is chosen, reads
 * only the pinned generation's pane documents, and reports a failed document
 * without exposing its details.
 */

import { expect } from "@playwright/test";

import type { CatalogueReadModel, MoklyViewerProps } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import { generationDocumentsNotice } from "./document_error_allowance.js";
import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("comparison is lazy, confined, and reports safe failures", async ({
  page,
  allowBrowserError,
}) => {
  const generation = `${fixture.host.url}/mokly-viewer/diffs/generations/${"a".repeat(64)}/`;
  allowBrowserError(generationDocumentsNotice(generation, 503));
  const comparisons: string[] = [];
  await page.route("**/mokly-viewer/diffs/**", async (route) => {
    comparisons.push(route.request().url());
    await route.fulfill({
      status: 503,
      json: { details: "/private/user/secret.ts" },
    });
  });
  await page.evaluate(() => {
    const host = window.viewerHarness.start("one");
    const catalogue = structuredClone(host.props.index) as CatalogueReadModel;
    catalogue.changesStatus = "ready";
    catalogue.baseCommit = "b".repeat(40);
    catalogue.comparisonUrl = `mokly-viewer/diffs/generations/${"a".repeat(64)}/`;
    for (const entry of [...catalogue.screens, ...catalogue.components])
      entry.changes = { status: "ready", kind: "changed", included: true };
    for (const view of catalogue.screens[0]!.views)
      view.comparison = { status: "ready", kind: "changed", eligible: true };
    // The routed detail carries each compared view's state and evidence.
    const home = host.details[catalogue.screens[0]!.path]!;
    home.views = home.views.map((view) => ({
      ...view,
      state: "changed" as const,
      ignoredIds: [],
      resourceEvidence: view.resourceEvidence ?? { rules: [], resources: [] },
    }));
    host.props = { ...host.props, index: catalogue } as MoklyViewerProps;
    host.render();
  });
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(comparisons).toHaveLength(0);
  await page.locator('[data-diff-mode="side"]').click();
  await expect(
    page.getByText("The comparison could not be loaded.", { exact: false }),
  ).toBeVisible();
  // A pinned comparison reads only its pane documents, never its root.
  expect(comparisons.length).toBeGreaterThan(0);
  for (const url of comparisons)
    expect(url.startsWith(`${generation}snapshots/`)).toBe(true);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error")
        .map((event) => event.value),
    ),
  ).toEqual([
    {
      code: "comparison",
      message: "The comparison could not be loaded. Try again.",
    },
  ]);
  await expect(page.getByText("/private/user/secret.ts")).toHaveCount(0);
  const rejected = await page.evaluate(async () => {
    try {
      await window.viewerHarness.get("one").ref.current.startPick();
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
});
