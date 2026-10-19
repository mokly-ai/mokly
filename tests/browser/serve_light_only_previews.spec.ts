/**
 * Light-only previous versions in Serve: a removed screen captured in Light
 * only falls back under Dark with a Light only label.
 */

import { expect } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { test } from "./serve_comparison_test.js";
import { PANE_SOURCE } from "./serve_comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

const stage = "[data-mokly-preview]";

test("Dark falls back to the light views a screen kept only", async ({
  page,
  changes,
}) => {
  const faded = viewerStatePaths.lightOnlyRemoved;
  const record = (await changes.index()).removedEntries.find(
    ({ entry }) => entry.path === faded,
  )!;
  await page.goto(`/view/${faded}/?snapshot=${record.snapshotId}`);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(
    page.locator(`${stage} .mbk-frame-desktop[data-color-scheme-fallback]`),
  ).toHaveCount(1);
  await expect(page.locator(`${stage} .mbk-frame-label`)).toHaveText(
    "Desktop — Light only",
  );
  await expect(
    page.locator(`${stage} .mbk-frame-desktop iframe`),
  ).toHaveAttribute(
    PANE_SOURCE,
    new RegExp(`/${faded}/index\\.desktop\\.html$`, "u"),
  );
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Faded screen");
});
