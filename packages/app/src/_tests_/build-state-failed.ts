import {
  buildCard,
  expectSteps,
  slotState,
  summaryProblems,
} from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * The failed row of the shared build state table: what a failed card
 * announces and where it sets its rows, its Try again at rest and refused,
 * and the new build Try again starts.
 */

/**
 * A failed build announces only its title and its cause's sentence, with the
 * reference set between them; Try again stands alone and publishes the same
 * branch again, and a refused one is announced beside itself.
 */
export const failed: BuildStateRow = {
  title:
    "a failed build announces only its cause, and Try again publishes again or says why it cannot",
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
    // A failure announces only its title and line.
    await expect(alert).toHaveCount(1);
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
    expect(
      await buildCard(page)
        .locator(".fo-build-summary")
        .evaluate(summaryProblems),
    ).toEqual([]);
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
    // Try again at rest stands alone in the action column.
    const action = page.locator(".fo-build-action");
    await expect(action.getByTestId("build-try-again")).toHaveText("Try again");
    await expect(
      action.locator(
        ".fo-state-pair, .review-inline, .fo-control-guide, .fo-write-failure",
      ),
    ).toHaveCount(0);
    await expect(action.getByRole("link")).toHaveCount(0);
    await page.getByTestId("build-try-again").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(next));
    expect(double.requests).toEqual([{ branch: "topic" }]);
    await expect(page.getByText("Waiting to start.")).toBeVisible();

    // A refused Try again is announced beside its control, and the message's
    // alert keeps only the title and the line.
    double.refuseRequest = { reason: "builds-unavailable" };
    await open(page, scenario.buildAt(id));
    await page.getByTestId("build-try-again").click();
    const card = buildCard(page);
    await expect(card.locator(".fo-write-failure [role=alert]")).toHaveText(
      "This project publishes from CI.",
    );
    await expect(card.locator(".fo-build-message")).toHaveAttribute(
      "role",
      "alert",
    );
    await expect(card.locator(".fo-build-message > *")).toHaveText([
      "Unable to publish this branch",
      "Installing dependencies failed.",
    ]);
  },
};
