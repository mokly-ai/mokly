import type { Page } from "@playwright/test";

import { installPollClock, settledReads } from "./build-clock";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { branchRow, buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * The order a reference with no ready publication chooses its stage in, as
 * `viewer-builds.md` gives it: a queued or running build first for every
 * plan, then a closed pull request's card, then a fork's, for every project
 * and plan, then the plan's cards and the rest. The order itself is checked
 * in `viewer/reference-stage.test.ts`, `viewer/stage-plan.test.ts` and
 * `viewer/entry-resolution.test.ts`; these tests check what a reader of a
 * refused plan is asked, and the lists the entry reads.
 */

/** A project on a plan that refuses publishing, as the double reports it. */
const refused = {
  buildsAvailable: true,
  canRequestBuilds: false,
  publishingAllowed: false,
  visibility: "private" as const,
};

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
  // A second list read would come from the page's own work or one of its
  // timers, so each check lets a second pass on the page's clock and waits
  // until no list read is in flight before it reads the list of reads.
  await installPollClock(
    page,
    String.raw`^/v1/projects/[^/]+/(branches|pull-requests)$`,
  );
  const settle = async () => {
    await page.clock.runFor(1_000);
    // A read that the page starts from the work of the last one is counted
    // by the next look, so look until two looks agree.
    let started = await settledReads(page);
    for (;;) {
      const again = await settledReads(page);
      if (again === started) return;
      started = again;
    }
  };

  // The route reads the pull request list for its chrome, and the entry
  // takes the alias's row from it.
  double.pullRequests = [pullRow({ fork: true })];
  expect(await stageTitle(page, scenario.pullAt(buildPullRequest.number))).toBe(
    "This pull request is from a fork",
  );
  await settle();
  expect(lists).toEqual(["pull requests"]);

  // A completed list with no row for the alias is not read again.
  lists.length = 0;
  expect(await stageTitle(page, scenario.pullAt(99))).toBe(
    "No publication yet",
  );
  await settle();
  expect(lists).toEqual(["pull requests"]);

  // The route reads no branch list, so a branch alias lists branches once.
  lists.length = 0;
  double.branches = [branchRow("topic")];
  expect(await stageTitle(page, scenario.branchAt("topic"))).toBe(
    "No publications yet",
  );
  await settle();
  expect(lists).toEqual(["branches"]);
});
