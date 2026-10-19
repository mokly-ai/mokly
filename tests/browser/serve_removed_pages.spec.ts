/**
 * A removed page in Serve keeps its baseline heading, folder context, and
 * Details, appears only in Changes as a flat row, and offers no comparison
 * controls; a current page keeps its fragment navigation through a reload.
 */

import { expect } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { chooseFilter } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

for (const width of [390, 1280]) {
  test(`removed published pages keep baseline context only in Changes at ${width}px`, async ({
    page,
    changes,
  }) => {
    const retired = changes.paths.removedPage;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${retired}/`);
    await expect(page.locator(".mbk-screen-head h2")).toHaveText(
      "Retired page",
    );
    // The base folder no longer exists, so its title is plain text.
    await expect(page.locator(".mbk-crumbs")).toHaveText("Pages");
    await expect(page.locator(".mbk-crumbs a")).toHaveCount(0);
    await expect(page.locator("#mb-main")).toContainText(
      "Showing previous version",
    );
    await expect(
      page.frameLocator("[data-mokly-preview] iframe").locator("body"),
    ).toContainText("Historical page");
    await expect(
      page.locator("[data-mokly-preview] [data-mokly-preview-retry]"),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-diff-screen], [data-viewport-option]"),
    ).toHaveCount(0);
    await page.locator("[data-mokly-details] summary").click();
    await expect(page.locator("[data-mokly-details]")).toContainText("Pages");
    if (width < 700)
      await page
        .getByRole("button", { name: "Open catalogue navigation" })
        .click();
    const removed = page.locator(`[data-entry-id="${retired}"]`);
    await expect(removed).toBeHidden();
    await chooseFilter(page, "changed");
    await expect(removed).toBeVisible();
    await expect(page.locator('[data-nav-folder="folder:pages"]')).toHaveCount(
      0,
    );
    expect(
      await removed.evaluate(
        (element) => element.closest("details[data-nav-folder]") === null,
      ),
    ).toBe(true);
    await chooseFilter(page, "all");
    await expect(removed).toBeHidden();
    await expect(
      page.locator(`[data-entry-id="${changes.paths.removedScreen}"]`),
    ).toBeVisible();

    const handbook = viewerStatePaths.fragmentPage;
    const frame = page.locator(".mbk-stage-embed iframe");
    await page.goto(`/view/${handbook}/?fragment=overview`);
    await expect(frame.contentFrame().locator("#overview")).toBeVisible();
    await expect(
      page.locator("[data-diff-screen], [data-viewport-option]"),
    ).toHaveCount(0);
    await page.reload();
    await expect(frame.contentFrame().locator("#overview")).toBeVisible();
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
    await expect
      .poll(() =>
        frame.evaluate(
          (element: HTMLIFrameElement) => element.contentWindow?.scrollY ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    await frame
      .contentFrame()
      .getByRole("link", { name: "Stable screen", exact: true })
      .click();
    await expect(page.locator(".mbk-screen-head h2")).toHaveText(
      "Stable screen",
    );
  });
}
