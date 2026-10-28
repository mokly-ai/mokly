/**
 * A copy built with base `HEAD`: Changes compares the current commit with
 * itself, so the publication is ready and lists no change. A screen that
 * changed against the fixture base stays usable as Unmodified, without
 * comparison controls, failed requests, or a live event stream.
 */

import { expect } from "@playwright/test";

import { additionsCopyTest } from "./additions_copy_test.js";
import { comparisonPaths } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  changesPaths,
  comparisonIndex,
} from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

const test = additionsCopyTest("browser-head-baseline", undefined, "HEAD");

test("the owning catalogue stays usable when HEAD is the unchanged baseline", async ({
  page,
  request,
  baseURL,
}, info) => {
  const index = await comparisonIndex(request, baseURL);
  expect(index.changesStatus).toBe("ready");
  expect(index.comparisonUrl).toMatch(/\/generations\/[a-f0-9]{64}\/$/u);
  expect(changesPaths(index)).toEqual([]);
  const failures: string[] = [];
  const requests: string[] = [];
  page.on("request", (sent) => requests.push(sent.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  const route = `/view/${comparisonPaths.changed}/?fragment=end`;
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await expect(page).toHaveURL(`${baseURL}${route}`);
    const viewport = width === 390 ? "mobile" : "desktop";
    await chooseViewport(page, viewport);
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await awaitRoutedDetail(page, comparisonPaths.changed);
    await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
    await expect(
      page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
    ).toHaveText("0");
    const frames = page.locator("[data-current-screen] iframe");
    await expect(
      frames.and(page.locator(`[data-workspace-frame="${viewport}"]`)),
    ).toBeVisible();
    for (const frame of await frames.all()) {
      await expect(frame.contentFrame().locator("h1")).toHaveText(
        "After screen",
      );
      await frame
        .contentFrame()
        .locator("body")
        .evaluate(async () => {
          await document.fonts.ready;
        });
    }
    await page.screenshot({ path: info.outputPath(`${width}-Current.png`) });
  }
  expect(failures).toEqual([]);
  expect(requests.some((url) => url.includes("/mokly-viewer/events"))).toBe(
    false,
  );
});
