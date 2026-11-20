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
 * A pull request that is closed or merged with nothing published, as
 * `product/viewer/pull-request/closed` and its `merged` variant draw it: no
 * build can publish it, so its alias names how it closed and offers the
 * switcher, whether or not the project can build.
 */

test("a closed or merged pull request names how it closed", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-closed");
  const { double, projectId } = scenario;
  const id = buildId(140);
  double.builds.set(
    id,
    build({
      id,
      projectId,
      state: "failed",
      pullRequest: buildPullRequest,
      canCancel: false,
      failure: { step: "publish", cause: "exit", exitCode: 1 },
    }),
  );
  const card = page.locator(".fo-stage-card");
  const titles = {
    closed: "This pull request is closed",
    merged: "This pull request was merged",
  } as const;
  for (const state of ["closed", "merged"] as const) {
    // Even its newest build, which failed, gives way: no build can publish a
    // pull request that is no longer open.
    double.pullRequests = [
      pullRow({ state, newestBuild: summary({ id, state: "failed" }) }),
    ];
    await open(page, scenario.pullAt(buildPullRequest.number));
    await expect(
      card.getByRole("heading", { name: titles[state] }),
    ).toBeVisible();
    // The title is the whole message: no line, and no way to publish.
    await expect(card.locator(".fo-state-detail")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Publish this pull request" }),
    ).toHaveCount(0);
    await expect(page.locator(".fo-build")).toHaveCount(0);
    await expect(page.locator(".fo-top-state")).toContainText("Not published");
  }
  await card.getByRole("button", { name: "Choose another branch" }).click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();

  // A reviewer and a project that cannot build read the same card: nobody is
  // told to wait for a member, or that its check will publish it.
  for (const project of [
    { buildsAvailable: true, canRequestBuilds: false, canAdmin: false },
    { buildsAvailable: false, canRequestBuilds: false },
  ]) {
    double.project = project;
    double.pullRequests = [pullRow({ state: "closed" })];
    await open(page, scenario.pullAt(buildPullRequest.number));
    await expect(
      card.getByRole("heading", { name: titles.closed }),
    ).toBeVisible();
    await expect(card).not.toContainText("Ask a member");
    await expect(card).not.toContainText("Publishing starts");
  }
  expect(double.requests).toEqual([]);

  // The same pull request, open again, is offered to publish.
  double.project = { buildsAvailable: true, canRequestBuilds: true };
  double.pullRequests = [pullRow()];
  await open(page, scenario.pullAt(buildPullRequest.number));
  await expect(
    page.getByRole("button", { name: "Publish this pull request" }),
  ).toBeVisible();
});
