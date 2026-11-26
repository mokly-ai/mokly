import type { Locator, Page } from "@playwright/test";

import { cardTitle, ciGuide } from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import { branchRow, build, buildId } from "./viewer/build-fixtures";

/**
 * The rows of the shared build state table where a request the card sent
 * still runs. The control that sent it carries the wait, as Write in progress
 * in `folio-chrome.md` defines: it keeps its place and the reader's focus,
 * shows its working word with the busy spinner, and a screen reader hears the
 * operation. Each row presses from the keyboard and holds the request until
 * it has read the control, then lets the request through.
 */

/** Hold every request posted to one address until the row lets it through. */
export async function holdRequest(page: Page, url: string) {
  const arrived = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    arrived.resolve();
    await answer.promise;
    return route.fallback();
  });
  return { arrived: arrived.promise, answer: () => answer.resolve() };
}

/** Press one control from the keyboard, the way a focused reader does. */
async function pressFromKeyboard(page: Page, control: Locator): Promise<void> {
  await control.focus();
  await page.keyboard.press("Enter");
}

/**
 * What the pressed control shows while its request runs: its working word,
 * busy, still enabled and still focused, and the operation, heard once.
 */
async function expectBusy(
  page: Page,
  control: Locator,
  working: string,
  operation: string,
): Promise<void> {
  await expect(control, "the working word").toHaveText(working);
  await expect(control, "busy").toHaveAttribute("aria-busy", "true");
  await expect(control, "still enabled").toBeEnabled();
  await expect(control, "still focused").toBeFocused();
  const name = operation + "…";
  await expect(
    page.getByRole("status").filter({ hasText: name }),
    "the operation is heard",
  ).toHaveCount(1);
  await expect(page.getByText(name), "said once").toHaveCount(1);
}

/** Publish this branch while its build request runs, with its guide beside it. */
export const publishBusy: BuildStateRow = {
  title: "a running publish request holds Publish this branch busy",
  label: "publish-busy",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(25);
    double.branches = [branchRow("topic")];
    double.nextBuild = build({
      id,
      projectId,
      state: "queued",
      step: null,
      startedAt: null,
    });
    await open(page, scenario.branchAt("topic"));
    const held = await holdRequest(page, `**/v1/projects/${projectId}/builds`);
    const control = page.getByTestId("stage-publish");
    await pressFromKeyboard(page, control);
    await held.arrived;
    await expectBusy(page, control, "Publishing…", "Publishing this branch");
    await expect(
      page.locator(".fo-stage-card").getByRole("link", {
        name: "Publish from CI",
      }),
    ).toHaveAttribute("href", ciGuide);

    held.answer();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(id));
    expect(double.requests).toEqual([{ branch: "topic" }]);
  },
};

/** A failed build's Try again while its build request runs. */
export const tryAgainBusy: BuildStateRow = {
  title: "a running Try again holds its control busy",
  label: "try-again-busy",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(26);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "failed",
        canCancel: false,
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    );
    const next = buildId(27);
    double.nextBuild = build({
      id: next,
      projectId,
      state: "queued",
      step: null,
      startedAt: null,
    });
    await open(page, scenario.buildAt(id));
    const held = await holdRequest(page, `**/v1/projects/${projectId}/builds`);
    const control = page.getByTestId("build-try-again");
    await pressFromKeyboard(page, control);
    await held.arrived;
    await expectBusy(page, control, "Publishing…", "Publishing this branch");
    await expect(
      cardTitle(page, "Unable to publish this branch"),
    ).toBeVisible();

    held.answer();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(next));
    expect(double.requests).toEqual([{ branch: "topic" }]);
  },
};

/** A running build's Cancel while its request runs. */
export const cancelBusy: BuildStateRow = {
  title: "a running Cancel holds its control busy",
  label: "cancel-busy",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(28);
    double.builds.set(id, build({ id, projectId }));
    await open(page, scenario.buildAt(id));
    const held = await holdRequest(
      page,
      `**/v1/projects/${projectId}/builds/${id}/cancel`,
    );
    const control = page.getByTestId("build-cancel");
    await pressFromKeyboard(page, control);
    await held.arrived;
    await expectBusy(page, control, "Cancelling…", "Cancelling this build");
    await expect(cardTitle(page, "Publishing this branch")).toBeVisible();

    held.answer();
    await expect(cardTitle(page, "Publishing was cancelled")).toBeFocused();
    expect(double.cancels).toEqual([id]);
  },
};
