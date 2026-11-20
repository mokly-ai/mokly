import type { Page } from "@playwright/test";

import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import {
  branchRow,
  build,
  buildId,
  buildPullRequest,
  pullRow,
  summary,
} from "./viewer/build-fixtures";

/**
 * The order a reference with no ready publication chooses its stage in, as
 * `viewer-builds.md` gives it: a queued or running build first for every
 * plan, then a closed pull request's card, then a fork's, for every project
 * and plan, then the plan's cards and the rest.
 */

/** A project on a plan that refuses publishing, as the double reports it. */
const refused = {
  buildsAvailable: true,
  canRequestBuilds: false,
  publishingAllowed: false,
  visibility: "private" as const,
};

test("a closed pull request whose build still runs shows that build, for every plan", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-order-closed");
  const { double, projectId } = scenario;
  const id = buildId(150);
  double.builds.set(
    id,
    build({ id, projectId, pullRequest: buildPullRequest, step: "publish" }),
  );
  const card = page.locator(".fo-build");
  for (const project of [double.project, refused]) {
    double.project = project;
    for (const state of ["closed", "merged"] as const) {
      double.pullRequests = [
        pullRow({ state, newestBuild: summary({ id, state: "running" }) }),
      ];
      await open(page, scenario.pullAt(buildPullRequest.number));
      await expect(
        card.getByRole("heading", { name: "Publishing this pull request" }),
      ).toBeVisible();
      await expect(page.locator(".fo-top-state")).toContainText(
        "Publishing now",
      );
      await expect(page.locator(".fo-stage-card .fo-state")).toHaveCount(0);
    }
  }
});

/**
 * The title of the one card the stage shows at a reference. A card that waits
 * for a read sits in a waiting region, and its title names that read or is a
 * bar, so the card the reference chose is the one outside every such region.
 */
async function stageTitle(page: Page, path: string): Promise<string> {
  await open(page, path);
  const title = page.locator(
    '.fo-stage-card .fo-state-title:not([aria-busy="true"] *)',
  );
  await expect(title).toHaveCount(1);
  return (await title.textContent()) ?? "";
}

test("while the plan refuses, a running build, a closed card and a fork card come first", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-order-plan");
  const { double, projectId } = scenario;
  double.project = refused;
  const id = buildId(151);
  double.builds.set(id, build({ id, projectId }));
  double.branches = [
    branchRow("topic", { newestBuild: summary({ id, state: "running" }) }),
  ];
  expect(await stageTitle(page, scenario.branchAt("topic"))).toBe(
    "Publishing this branch",
  );
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");

  // A finished build gives way to the plan's own card.
  double.branches = [
    branchRow("topic", { newestBuild: summary({ id, state: "failed" }) }),
  ];
  expect(await stageTitle(page, scenario.branchAt("topic"))).toBe(
    "Publishing to private projects is on Team",
  );

  // An open pull request of the project's repository gets the Team card a
  // branch gets, because its check publishes nothing on this plan, and its
  // failed build gives way to the card too.
  const pull = scenario.pullAt(buildPullRequest.number);
  for (const row of [
    pullRow(),
    pullRow({ newestBuild: summary({ id, state: "failed" }) }),
  ]) {
    double.pullRequests = [row];
    expect(await stageTitle(page, pull)).toBe(
      "Publishing to private projects is on Team",
    );
    await expect(page.getByText("Publishing starts")).toHaveCount(0);
    await expect(page.getByTestId("stage-open-billing")).toBeVisible();
    await expect(
      page
        .locator(".fo-stage-card")
        .getByRole("button", { name: "Choose another branch" }),
    ).toBeVisible();
    await expect(page.locator(".fo-build")).toHaveCount(0);
  }
  double.pullRequests = [pullRow({ state: "closed" })];
  expect(await stageTitle(page, pull)).toBe("This pull request is closed");
  double.pullRequests = [pullRow({ fork: true })];
  expect(await stageTitle(page, pull)).toBe("This pull request is from a fork");
  await expect(page.getByText("Publishing starts")).toHaveCount(0);
  expect(double.requests).toEqual([]);
});

test("a plan-refused pull request asks everyone but an owner to ask one", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-order-plan-reader");
  const { double } = scenario;
  double.project = refused;
  double.pullRequests = [pullRow()];
  await page.route("**/v1/workspaces/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const answer = await route.fetch();
    const body = (await answer.json()) as { role: string };
    return route.fulfill({
      response: answer,
      json: { ...body, role: "admin" },
    });
  });
  expect(await stageTitle(page, scenario.pullAt(buildPullRequest.number))).toBe(
    "Publishing to private projects is on Team",
  );
  const card = page.locator(".fo-stage-card");
  await expect(card.locator(".fo-state-detail")).toHaveText(
    "Ask an owner to upgrade to Team.",
  );
  await expect(page.getByTestId("stage-open-billing")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveText(["Choose another branch"]);
  await expect(page.getByText("Publishing starts")).toHaveCount(0);
});

test("the entry lists no reference again when the route holds its list", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-order-lists");
  const { double, projectId } = scenario;
  const lists: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") return;
    const path = new URL(request.url()).pathname;
    const prefix = "/v1/projects/" + projectId + "/";
    if (path === prefix + "pull-requests") lists.push("pull requests");
    if (path === prefix + "branches") lists.push("branches");
  });

  // The route reads the pull request list for its chrome, and the entry
  // takes the alias's row from it.
  double.pullRequests = [pullRow({ fork: true })];
  expect(await stageTitle(page, scenario.pullAt(buildPullRequest.number))).toBe(
    "This pull request is from a fork",
  );
  await page.waitForTimeout(1_000);
  expect(lists).toEqual(["pull requests"]);

  // A completed list with no row for the alias is not read again.
  lists.length = 0;
  expect(await stageTitle(page, scenario.pullAt(99))).toBe(
    "No publication yet",
  );
  await page.waitForTimeout(1_000);
  expect(lists).toEqual(["pull requests"]);

  // The route reads no branch list, so a branch alias lists branches once.
  lists.length = 0;
  double.branches = [branchRow("topic")];
  expect(await stageTitle(page, scenario.branchAt("topic"))).toBe(
    "No publications yet",
  );
  await page.waitForTimeout(1_000);
  expect(lists).toEqual(["branches"]);
});
