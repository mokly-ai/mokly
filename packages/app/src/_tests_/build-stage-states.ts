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
 * offers no action.
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

/** The publishing card's states for an owner, who may request a build. */
export const stageStates: readonly CardState[] = [
  {
    name: "publishing card for a branch",
    show: (page, s) => openStage(page, s, s.branchAt("topic"), branchHeading),
  },
  {
    name: "publishing card for a pull request",
    show: (page, s) => openStage(page, s, pullAt(s), pullHeading),
  },
  {
    name: "refused publish request that can be tried again",
    show: async (page, s) => {
      s.double.refuseRequest = { reason: "unavailable" };
      await openStage(page, s, s.branchAt("topic"), branchHeading);
      await refusePublish(page, "Mokly is busy. Try again in a moment.");
      s.double.refuseRequest = undefined;
    },
  },
  {
    name: "refused publish request for a project that publishes from CI",
    show: async (page, s) => {
      s.double.refuseRequest = { reason: "builds-unavailable" };
      await openStage(page, s, pullAt(s), pullHeading);
      await refusePublish(page, "This project publishes from CI.");
      s.double.refuseRequest = undefined;
    },
  },
  {
    name: "running publish request",
    show: async (page, s) => {
      queueNext(s);
      await openStage(page, s, s.branchAt("topic"), branchHeading);
      const url = `**/v1/projects/${s.projectId}/builds`;
      return holdPress(page, url, "stage-publish", "Publishing…", () =>
        page.waitForURL((at) => at.pathname === s.buildAt(ids.next)),
      );
    },
  },
  {
    name: "closed pull request",
    show: async (page, s) => {
      s.double.pullRequests = [pullRow({ state: "closed" })];
      await open(page, pullAt(s));
      await expect(
        page.getByRole("heading", { name: "This pull request is closed" }),
      ).toBeVisible();
    },
  },
];

/** Make the scenario's owner read the project as a reviewer from now on. */
export async function becomeReviewer(
  page: Page,
  scenario: BuildScenario,
): Promise<void> {
  scenario.double.project = reviewerProject;
  await readAsReviewer(page);
}

/** The states a reviewer reaches, who may neither request nor cancel. */
export const reviewerStates: readonly CardState[] = [
  {
    name: "reviewer's queued build",
    show: async (page, s) => {
      s.double.builds.set(
        ids.reviewer,
        queuedForReviewer(ids.reviewer, s.projectId),
      );
      await open(page, s.buildAt(ids.reviewer));
      await expect(page.getByText("Waiting to start.")).toBeVisible();
    },
  },
  {
    name: "reviewer's running build",
    show: (page, s) =>
      openBuild(
        page,
        s,
        { id: ids.reviewer, step: "checkout", canCancel: false },
        "Publishing this branch",
      ),
  },
  {
    name: "reviewer's publishing card for a branch",
    show: async (page, s) => {
      await openStage(page, s, s.branchAt("topic"), branchHeading);
      await expect(page.locator(".fo-stage-card")).toContainText(
        "Ask a member or administrator to publish this branch.",
      );
    },
  },
  {
    name: "reviewer's publishing card for a pull request",
    show: async (page, s) => {
      await openStage(page, s, pullAt(s), pullHeading);
      await expect(page.locator(".fo-stage-card")).toContainText(
        "Ask a member or administrator to publish this pull request.",
      );
    },
  },
];

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

/** The publishing card a reader without member access reads. */
export const outsiderStates: readonly CardState[] = [
  {
    name: "publishing card for a reader outside the workspace",
    show: async (page, s) => {
      await open(page, s.branchAt("topic"));
      await expect(page.locator(".fo-stage-card")).toContainText(
        "An administrator publishes this project.",
      );
    },
  },
];
