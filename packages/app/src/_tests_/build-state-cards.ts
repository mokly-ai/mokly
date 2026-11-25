import { holdPolls, nextPoll } from "./build-clock";
import { advance, write } from "./build-double";
import {
  buildCard,
  cardTitle,
  ciGuide,
  expectSteps,
  slotState,
  step,
} from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import { createToken, publish } from "./publish";
import { branchRow, build, buildId } from "./viewer/build-fixtures";
import { publishedViewerReady } from "./viewer/support";

/**
 * The rows of the shared build state table that follow one build through the
 * card's states and the action each offers, as the build card table of
 * `viewer-builds.md` gives them.
 */

/**
 * Publish this branch starts a queued build that waits with Cancel; the worker
 * starts it; Cancel stops it, moves focus to the new title and says it; and
 * the cancelled card's Try again publishes the same branch again.
 */
export const follow: BuildStateRow = {
  title: "a queued build runs, Cancel stops it and Try again publishes again",
  label: "follow",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(1);
    double.branches = [branchRow("topic")];
    double.nextBuild = build({
      id,
      projectId,
      state: "queued",
      step: null,
      startedAt: null,
    });
    await holdPolls(page);
    await open(page, scenario.branchAt("topic"));
    const stage = page.locator(".fo-stage-card");
    await expect(
      stage.getByRole("heading", { name: "No publications yet" }),
    ).toBeVisible();
    await expect(
      stage.getByRole("link", { name: "Publish from CI" }),
    ).toHaveAttribute("href", ciGuide);
    await stage.getByRole("button", { name: "Publish this branch" }).click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(id));
    expect(double.requests).toEqual([{ branch: "topic" }]);

    // Queued: every step waits, and Cancel is the card's one action.
    await expect(cardTitle(page, "Publishing this branch")).toBeVisible();
    await expect(buildCard(page).locator(".fo-build-line")).toHaveText(
      "Waiting to start.",
    );
    await expectSteps(page, ["Waiting", "Waiting", "Waiting"]);
    await expect(page.getByTestId("build-cancel")).toHaveText("Cancel");
    await expect(page.getByTestId("build-output")).toHaveCount(0);
    await expect(page.getByTestId("viewer-publication")).toContainText("topic");
    await expect(slotState(page)).toContainText("Publishing now");

    // Running: the next read moves the steps and shows the output.
    advance(double, id, {
      state: "running",
      step: "install",
      startedAt: "2026-09-15T16:30:05Z",
    });
    write(double, id, [
      { text: "$ npm ci\n", stream: "system", step: "install" },
      { text: "added 412 packages\n", step: "install" },
    ]);
    await nextPoll(page);
    await expect(page.getByTestId("build-output")).toContainText(
      "added 412 packages",
    );
    await expectSteps(page, ["Done", "Running", "Waiting"]);
    await expect(buildCard(page).locator(".fo-build-line")).toHaveCount(0);

    // Cancel: the control is gone, so focus and a polite status say the title.
    // The browser shows focus to the keyboard only, so a pointer press draws
    // no outline on the title.
    await page.getByTestId("build-cancel").click();
    const title = cardTitle(page, "Publishing was cancelled");
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute("tabindex", "-1");
    await expect(title).toHaveCSS("outline-style", "none");
    await expect(buildCard(page).getByRole("status")).toHaveText(
      "Publishing was cancelled",
    );
    await expect(page.getByTestId("build-cancel")).toHaveCount(0);
    await expect(buildCard(page).getByRole("alert")).toHaveCount(0);
    await expect(step(page, "install")).toContainText("Stopped");
    await expect(slotState(page)).toContainText("Not published");
    expect(double.cancels).toEqual([id]);

    // Cancelled: Try again publishes the same branch and follows the build.
    const next = buildId(2);
    double.nextBuild = build({
      id: next,
      projectId,
      state: "queued",
      step: null,
      startedAt: null,
    });
    await page.getByTestId("build-try-again").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(next));
    expect(double.requests).toEqual([{ branch: "topic" }, { branch: "topic" }]);
    await expect(page.getByText("Waiting to start.")).toBeVisible();
  },
};

/** A published build opens its catalogue on Changes, because it had a base. */
export const published: BuildStateRow = {
  title: "a published build opens its catalogue",
  label: "published",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(3);
    const token = await createToken(page, projectId);
    const made = await publish(token, projectId, { branch: "topic" });
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "published",
        step: "publish",
        publicationId: made.id,
        finishedAt: "2026-09-15T16:40:00Z",
        canCancel: false,
      }),
    );
    await open(page, scenario.buildAt(id));
    await expect(cardTitle(page, "Published this branch")).toBeVisible();
    await expectSteps(page, ["Done", "Done", "Done"]);
    await expect(buildCard(page).locator(".fo-build-line")).toHaveCount(0);
    await expect(buildCard(page).getByRole("alert")).toHaveCount(0);
    await expect(slotState(page)).toContainText("Ready · ");
    await page.getByTestId("build-open-catalogue").click();
    await page.waitForURL(
      (url) =>
        url.pathname.endsWith("/publications/" + made.id) &&
        url.searchParams.get("view") === "changes",
    );
    await publishedViewerReady(page);
    await expect(page.getByTestId("viewer-publication")).toContainText("topic");
  },
};

/**
 * A failed build announces only its title and its cause's sentence, and Try
 * again publishes the same branch again.
 */
export const failed: BuildStateRow = {
  title: "a failed build says its cause, and Try again publishes again",
  label: "failed",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(4);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "failed",
        canCancel: false,
        finishedAt: "2026-09-15T16:40:00Z",
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    );
    await open(page, scenario.buildAt(id));
    const alert = buildCard(page).getByRole("alert");
    await expect(alert.locator(":scope > *")).toHaveText([
      "Unable to publish this branch",
      "Installing dependencies failed.",
    ]);
    await expect(
      alert.locator(".fo-build-reference, a, button, [role=button]"),
    ).toHaveCount(0);
    await expect(buildCard(page).locator(".fo-build-reference")).toContainText(
      "topic",
    );
    await expectSteps(page, ["Done", "Failed", "Not run"]);
    await expect(slotState(page)).toContainText("Unable to publish");
    const next = buildId(5);
    double.nextBuild = build({
      id: next,
      projectId,
      state: "queued",
      step: null,
      startedAt: null,
    });
    await expect(page.getByTestId("build-try-again")).toHaveText("Try again");
    await page.getByTestId("build-try-again").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(next));
    expect(double.requests).toEqual([{ branch: "topic" }]);
    await expect(page.getByText("Waiting to start.")).toBeVisible();
  },
};

/** A build that went quiet ends timed out, and says so with Try again. */
export const timedOut: BuildStateRow = {
  title: "a timed-out build says why it stopped, with Try again",
  label: "timed-out",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(6);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "timed-out",
        step: "publish",
        canCancel: false,
        failure: { step: "publish", cause: "idle", exitCode: null },
      }),
    );
    await open(page, scenario.buildAt(id));
    await expect(
      cardTitle(page, "Unable to publish this branch"),
    ).toBeVisible();
    await expect(buildCard(page).locator(".fo-build-line")).toHaveText(
      "The build stopped after going quiet.",
    );
    await expectSteps(page, ["Done", "Done", "Failed"]);
    await expect(page.getByTestId("build-try-again")).toHaveText("Try again");
    await expect(slotState(page)).toContainText("Unable to publish");
  },
};

/** A newer push replaced this build, and its card opens the newer one. */
export const superseded: BuildStateRow = {
  title: "a superseded build opens the newer build",
  label: "superseded",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const older = buildId(7);
    const newer = buildId(8);
    double.builds.set(
      older,
      build({
        id: older,
        projectId,
        state: "superseded",
        supersededBy: newer,
        canCancel: false,
      }),
    );
    double.builds.set(newer, build({ id: newer, projectId }));
    await open(page, scenario.buildAt(older));
    await expect(
      cardTitle(page, "A newer push replaced this build"),
    ).toBeVisible();
    await expectSteps(page, ["Done", "Stopped", "Not run"]);
    await expect(buildCard(page).locator(".fo-build-line")).toHaveCount(0);
    await expect(slotState(page)).toContainText("Not published");
    await page.getByTestId("build-open-newer").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(newer));
    await expect(cardTitle(page, "Publishing this branch")).toBeVisible();
  },
};
