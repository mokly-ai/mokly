import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import {
  attempt,
  buildPullRequest,
  pullRow,
  summary,
} from "./viewer/build-fixtures";

/**
 * An open pull request from a fork with nothing published, as
 * `product/viewer/pull-request/fork` draws it: no build runs for a fork, so
 * its alias names the fact, says what the reader can do instead and offers the
 * switcher, for every project and plan. `viewer/stage-pull-requests.test.ts`
 * checks that every project and plan gets this card; this test draws it for a
 * project whose plan refuses publishing, where the Team card could stand in.
 */

test("a pull request from a fork says so, even where the plan refuses publishing", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-fork");
  const { double } = scenario;
  const card = page.locator(".fo-stage-card");
  double.project = {
    buildsAvailable: true,
    canRequestBuilds: false,
    publishingAllowed: false,
    visibility: "private",
  };
  double.pullRequests = [
    // Neither its failed publication nor its failed build stands in for the
    // card, on the stage or in the publication slot.
    pullRow({
      fork: true,
      newestPublication: attempt({ state: "failed" }),
      newestBuild: summary({ state: "failed" }),
    }),
  ];
  await open(page, scenario.pullAt(buildPullRequest.number));
  await expect(
    card.getByRole("heading", { name: "This pull request is from a fork" }),
  ).toBeVisible();
  await expect(card.locator(".fo-state-detail")).toHaveText(
    "Review this pull request’s screens locally.",
  );
  // Nobody is offered a way to publish it, told to ask a member, told its
  // check will publish it or sent to the CI setup guide.
  await expect(card.getByRole("button")).toHaveText(["Choose another branch"]);
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(card).not.toContainText("Ask a member");
  await expect(card).not.toContainText("Publishing starts");
  await expect(page.locator(".fo-build")).toHaveCount(0);
  await expect(page.locator(".fo-top-state")).toContainText("Not published");
  await card.getByRole("button", { name: "Choose another branch" }).click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  expect(double.requests).toEqual([]);
});
