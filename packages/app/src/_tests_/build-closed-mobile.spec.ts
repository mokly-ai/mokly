import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * A phone's closed or merged pull request, as
 * `product/viewer/pull-request/closed` and its `merged` variant draw it.
 */

test("a phone names a closed or merged pull request", async ({ page }) => {
  const scenario = await buildScenario(page, "build-mobile-closed");
  const { double } = scenario;
  const card = page.locator(".fo-stage-card");
  const titles = {
    closed: "This pull request is closed",
    merged: "This pull request was merged",
  } as const;
  for (const state of ["closed", "merged"] as const)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      double.pullRequests = [pullRow({ state })];
      await open(page, scenario.pullAt(buildPullRequest.number));
      await expect(
        card.getByRole("heading", { name: titles[state] }),
      ).toBeVisible();
      await expect(card.locator(".fo-state-detail")).toHaveCount(0);
      await expect(
        card.getByRole("button", { name: "Choose another branch" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Publish this pull request" }),
      ).toHaveCount(0);
      expect(await scrollsSideways(page), state + " at " + width).toBe(false);
    }
  await card.getByRole("button", { name: "Choose another branch" }).click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  expect(double.requests).toEqual([]);
});
