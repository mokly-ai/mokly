import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import {
  build,
  buildId,
  buildPullRequest,
  pullRow,
  summary,
} from "./viewer/build-fixtures";

/**
 * A phone's stage order: a closed pull request whose build still runs shows
 * that build, a plan that refuses publishing still shows the closed card, and
 * the same pull request open again shows the Team card.
 */

test("a phone shows a closed pull request's running build, then its closed card and the Team card", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-order");
  const { double, projectId } = scenario;
  const id = buildId(480);
  double.builds.set(
    id,
    build({ id, projectId, pullRequest: buildPullRequest, step: "publish" }),
  );
  const pull = scenario.pullAt(buildPullRequest.number);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    double.project = { buildsAvailable: true, canRequestBuilds: true };
    double.pullRequests = [
      pullRow({
        state: "closed",
        newestBuild: summary({ id, state: "running" }),
      }),
    ];
    await open(page, pull);
    await expect(
      page.getByRole("heading", { name: "Publishing this pull request" }),
    ).toBeVisible();
    expect(await scrollsSideways(page), "build at " + width).toBe(false);

    // Once nothing runs, the closed card stands even while the plan refuses.
    double.project = {
      buildsAvailable: true,
      canRequestBuilds: false,
      publishingAllowed: false,
      visibility: "private",
    };
    double.pullRequests = [pullRow({ state: "closed" })];
    await open(page, pull);
    await expect(
      page.getByRole("heading", { name: "This pull request is closed" }),
    ).toBeVisible();
    await expect(page.getByText("Publishing starts")).toHaveCount(0);
    expect(await scrollsSideways(page), "closed at " + width).toBe(false);

    // Open again, it gets the Team card a branch gets while the plan refuses.
    double.pullRequests = [pullRow()];
    await open(page, pull);
    await expect(
      page.getByRole("heading", {
        name: "Publishing to private projects is on Team",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("stage-open-billing")).toBeVisible();
    await expect(page.getByText("Publishing starts")).toHaveCount(0);
    expect(await scrollsSideways(page), "Team card at " + width).toBe(false);
  }
});
