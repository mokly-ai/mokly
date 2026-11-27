import { installPollClock, nextPoll } from "./build-clock";
import { advance } from "./build-double";
import {
  expectWaitingWithNoAction,
  queuedForReviewer,
  readAsReviewer,
  reviewerProject,
} from "./build-reader";
import {
  buildCard,
  cardTitle,
  ciGuide,
  expectSteps,
  slotState,
} from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import {
  branchRow,
  build,
  buildId,
  buildPullRequest,
  pullRow,
} from "./viewer/build-fixtures";

/**
 * The rows of the shared build state table whose card depends on the reader:
 * an owner's way past a plan refusal, the CI guide for a lockfile builds
 * cannot install, and a reviewer's build and publishing card, which offer no
 * request because a reviewer may make none.
 */

/** A build the plan refused offers its owner Open billing. */
export const planOwner: BuildStateRow = {
  title: "a plan refusal offers an owner Open billing",
  label: "plan-owner",
  run: async (page, scenario, surface) => {
    const { double, projectId } = scenario;
    const id = buildId(10);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "failed",
        step: null,
        canCancel: false,
        failure: { step: null, cause: "plan-required", exitCode: null },
      }),
    );
    await open(page, scenario.buildAt(id));
    await expect(
      cardTitle(page, "Publishing to private projects is on Team"),
    ).toBeVisible();
    await expectSteps(page, ["Not run", "Not run", "Not run"]);
    await expect(buildCard(page).locator(".fo-build-line")).toHaveCount(0);
    await page.getByTestId("build-open-billing").click();
    await surface.expectBilling(page);
  },
};

/** A lockfile builds cannot install links the CI guide in place of Try again. */
export const lockfile: BuildStateRow = {
  title: "a lockfile builds cannot install links the CI guide",
  label: "lockfile",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(11);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "failed",
        canCancel: false,
        failure: {
          step: "install",
          cause: "unsupported-lockfile",
          exitCode: null,
        },
      }),
    );
    await open(page, scenario.buildAt(id));
    await expect(buildCard(page).locator(".fo-build-line")).toHaveText(
      "Mokly installs with npm, pnpm or Yarn.",
    );
    const action = page.locator(".fo-build-action");
    const guide = action.getByRole("link", { name: "Publish from CI" });
    await expect(guide).toHaveAttribute("href", ciGuide);
    await expect(guide).toHaveAttribute("target", "_blank");
    await expect(page.getByTestId("build-try-again")).toHaveCount(0);
    await expect(action.locator("button")).toHaveCount(0);
  },
};

/**
 * A reviewer's queued build waits to start and offers no Cancel, and it
 * offers nothing once a worker claims it either.
 */
export const reviewerBuild: BuildStateRow = {
  title: "a reviewer's queued build offers no action",
  label: "reviewer-build",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    double.project = reviewerProject;
    await readAsReviewer(page);
    const id = buildId(12);
    double.builds.set(id, queuedForReviewer(id, projectId));
    await installPollClock(page);
    await open(page, scenario.buildAt(id));
    await expectWaitingWithNoAction(page);
    await expect(slotState(page)).toContainText("Publishing now");
    advance(double, id, {
      state: "running",
      step: "checkout",
      startedAt: "2026-09-15T16:31:00Z",
    });
    await nextPoll(page);
    await expect(
      buildCard(page).locator('[data-mkc-build-step="checkout"]'),
    ).toContainText("Running");
    await expect(buildCard(page).locator(".fo-build-line")).toHaveCount(0);
    await expect(buildCard(page).locator(".fo-build-action")).toHaveCount(0);
    await expect(page.getByTestId("build-cancel")).toHaveCount(0);
    expect(double.cancels).toEqual([]);
  },
};

/**
 * A reviewer of a project that can build is asked to wait for a member, for a
 * branch and for a pull request; a reader without member access sees no
 * build card at all and reads the viewer as before.
 */
export const reviewerCard: BuildStateRow = {
  title: "a reviewer's publishing card asks a member to publish",
  label: "reviewer-card",
  run: async (page, scenario) => {
    const { double } = scenario;
    double.project = reviewerProject;
    double.branches = [branchRow("topic")];
    double.pullRequests = [pullRow()];
    const card = page.locator(".fo-stage-card");
    await open(page, scenario.branchAt("topic"));
    await expect(
      card.getByRole("heading", { name: "No publications yet" }),
    ).toBeVisible();
    await expect(card).toContainText(
      "Ask a member or administrator to publish this branch.",
    );
    await expect(
      card.getByRole("button", { name: "Publish this branch" }),
    ).toHaveCount(0);
    await expect(card.getByRole("link")).toHaveCount(0);
    await card.getByRole("button", { name: "Choose another branch" }).click();
    await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();

    await open(page, scenario.pullAt(buildPullRequest.number));
    await expect(
      card.getByRole("heading", { name: "No publication yet" }),
    ).toBeVisible();
    await expect(card).toContainText(
      "Ask a member or administrator to publish this pull request.",
    );
    await expect(card).not.toContainText("Publishing starts");

    // Builds are shown to readers with member access only.
    await page.route("**/v1/session", async (route) => {
      const answer = await route.fetch();
      const body = (await answer.json()) as { workspaceIds: string[] };
      return route.fulfill({
        response: answer,
        json: { ...body, workspaceIds: [] },
      });
    });
    await open(page, scenario.branchAt("topic"));
    await expect(card).toContainText(
      "An administrator publishes this project.",
    );
    await expect(card).not.toContainText("Ask a member");
    expect(double.requests).toEqual([]);
  },
};
