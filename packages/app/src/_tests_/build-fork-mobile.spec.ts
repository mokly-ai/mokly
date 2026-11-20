import { enlargeText, scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * A phone's pull request from a fork, as `product/viewer/pull-request/fork`
 * draws it, at 390px, at 320px and at 320px with 200% text.
 */

test("a phone names a pull request from a fork", async ({ page }) => {
  const scenario = await buildScenario(page, "build-mobile-fork");
  const { double } = scenario;
  const card = page.locator(".fo-stage-card");
  double.pullRequests = [pullRow({ fork: true })];
  for (const { width, enlarged } of [
    { width: 390, enlarged: false },
    { width: 320, enlarged: false },
    { width: 320, enlarged: true },
  ]) {
    const where = width + "px" + (enlarged ? " with 200% text" : "");
    await page.setViewportSize({ width, height: 844 });
    await open(page, scenario.pullAt(buildPullRequest.number));
    if (enlarged) await enlargeText(page);
    await expect(
      card.getByRole("heading", { name: "This pull request is from a fork" }),
    ).toBeVisible();
    await expect(card.locator(".fo-state-detail")).toHaveText(
      "Review this pull request’s screens locally.",
    );
    await expect(
      card.getByRole("button", { name: "Choose another branch" }),
    ).toBeVisible();
    await expect(card.getByRole("link")).toHaveCount(0);
    expect(await scrollsSideways(page), where).toBe(false);
  }
  await card.getByRole("button", { name: "Choose another branch" }).click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  expect(double.requests).toEqual([]);
});
