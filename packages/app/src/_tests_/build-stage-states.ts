import type { Page } from "@playwright/test";

import {
  holdPress,
  ids,
  openBuild,
  openStage,
  queueNext,
} from "./build-card-parts";
import type { CardState } from "./build-card-parts";
import {
  queuedForReviewer,
  readAsReviewer,
  reviewerProject,
} from "./build-reader";
import type { BuildScenario } from "./build-scenario";
import { expect, open } from "./harness";
import { buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * Every state the stage's publishing card draws, for an owner, for a reviewer
 * and for a reader outside the workspace, and a reviewer's build card, which
 * offers no action. `build-card-walk.ts` keys them by the unions.
 */

const branchHeading = "No publications yet";
const pullHeading = "No publication yet";

/** The refused publish request's cause, above its control. */
async function refusePublish(page: Page, sentence: string): Promise<void> {
  await page.getByTestId("stage-publish").click();
  await expect(
    page.locator(".fo-state-action .fo-write-failure [role=alert]"),
  ).toHaveText(sentence);
}

const pullAt = (s: BuildScenario) => s.pullAt(buildPullRequest.number);

export const branchCard: CardState = {
  name: "publishing card for a branch",
  reader: "owner",
  show: (page, s) => openStage(page, s, s.branchAt("topic"), branchHeading),
};

export const pullCard: CardState = {
  name: "publishing card for a pull request",
  reader: "owner",
  show: (page, s) => openStage(page, s, pullAt(s), pullHeading),
};

export const refusedPublish: CardState = {
  name: "refused publish request that can be tried again",
  reader: "owner",
  show: async (page, s) => {
    s.double.refuseRequest = { reason: "unavailable" };
    await branchCard.show(page, s);
    await refusePublish(page, "Mokly is busy. Try again in a moment.");
    s.double.refuseRequest = undefined;
  },
};

export const refusedFromCi: CardState = {
  name: "refused publish request for a project that publishes from CI",
  reader: "owner",
  show: async (page, s) => {
    s.double.refuseRequest = { reason: "builds-unavailable" };
    await pullCard.show(page, s);
    await refusePublish(page, "This project publishes from CI.");
    s.double.refuseRequest = undefined;
  },
};

export const runningPublish: CardState = {
  name: "running publish request",
  reader: "owner",
  show: async (page, s) => {
    queueNext(s);
    await branchCard.show(page, s);
    const url = `**/v1/projects/${s.projectId}/builds`;
    return holdPress(page, url, "stage-publish", "Publishing…", () =>
      page.waitForURL((at) => at.pathname === s.buildAt(ids.next)),
    );
  },
};

export const closedPull: CardState = {
  name: "closed pull request",
  reader: "owner",
  show: async (page, s) => {
    s.double.pullRequests = [pullRow({ state: "closed" })];
    await open(page, pullAt(s));
    await expect(
      page.getByRole("heading", { name: "This pull request is closed" }),
    ).toBeVisible();
  },
};

/** Make the scenario's owner read the project as a reviewer from now on. */
export async function becomeReviewer(
  page: Page,
  scenario: BuildScenario,
): Promise<void> {
  scenario.double.project = reviewerProject;
  await readAsReviewer(page);
}

export const reviewerQueued: CardState = {
  name: "reviewer's queued build",
  reader: "reviewer",
  show: async (page, s) => {
    const queued = queuedForReviewer(ids.reviewer, s.projectId);
    s.double.builds.set(ids.reviewer, queued);
    await open(page, s.buildAt(ids.reviewer));
    await expect(page.getByText("Waiting to start.")).toBeVisible();
  },
};

export const reviewerRunning: CardState = {
  name: "reviewer's running build",
  reader: "reviewer",
  show: (page, s) =>
    openBuild(
      page,
      s,
      { id: ids.reviewer, step: "checkout", canCancel: false },
      "Publishing this branch",
    ),
};

export const reviewerBranchCard: CardState = {
  name: "reviewer's publishing card for a branch",
  reader: "reviewer",
  show: async (page, s) => {
    await branchCard.show(page, s);
    await expect(page.locator(".fo-stage-card")).toContainText(
      "Ask a member or administrator to publish this branch.",
    );
  },
};

export const reviewerPullCard: CardState = {
  name: "reviewer's publishing card for a pull request",
  reader: "reviewer",
  show: async (page, s) => {
    await pullCard.show(page, s);
    await expect(page.locator(".fo-stage-card")).toContainText(
      "Ask a member or administrator to publish this pull request.",
    );
  },
};

/**
 * Make the reader one the session names in no workspace from now on, as a
 * reader without member access is.
 */
export async function leaveWorkspace(page: Page): Promise<void> {
  await page.route("**/v1/session", async (route) => {
    const answer = await route.fetch();
    const body = (await answer.json()) as { workspaceIds: string[] };
    return route.fulfill({
      response: answer,
      json: { ...body, workspaceIds: [] },
    });
  });
}

export const outsiderCard: CardState = {
  name: "publishing card for a reader outside the workspace",
  reader: "outsider",
  show: async (page, s) => {
    await open(page, s.branchAt("topic"));
    await expect(page.locator(".fo-stage-card")).toContainText(
      "An administrator publishes this project.",
    );
  },
};
