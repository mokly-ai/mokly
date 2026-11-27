import {
  buildRefusal,
  publishRefusal,
  refusalLayout,
  refusals,
  refuseTryAgain,
  scrollsSideways,
} from "./build-refusals";
import type { RefusalParts } from "./build-refusals";
import { buildCard, cardTitle, ciGuide } from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import { createToken, publish } from "./publish";
import {
  branchRow,
  build,
  buildId,
  buildPullRequest,
  pullRow,
} from "./viewer/build-fixtures";
import { publishedViewerReady } from "./viewer/support";

/**
 * The rows of the shared build state table where a request the card sent was
 * refused, or answered by what already answers for the head. Each refusal is
 * reported beside the control that sent it, through the write-failure
 * fragment: the cause above the control and Details beneath.
 */

/** The publishing card's refusal, in the stage card's state body. */
const publishFragment = ".fo-state-action > .fo-write-failure";

/**
 * The publishing card's control reads the way back where Mokly was only busy,
 * and keeps its own label where the project publishes from CI; the CI guide
 * stays beside it either way.
 */
export const publishRefused: BuildStateRow = {
  title: "a refused publish request reads the way back only where it can work",
  label: "publish-refused",
  run: async (page, scenario) => {
    const { double } = scenario;
    double.branches = [branchRow("topic")];
    double.pullRequests = [pullRow()];
    const state = page.locator(".fo-stage-card .fo-state");
    const fragment = state.locator(publishFragment);
    // The shared control with guide: Publish from CI stays beside the
    // control, between the refusal and Details.
    const row = fragment.locator(":scope > .fo-control-guide");
    const control = row.getByTestId("stage-publish");
    for (const refused of [
      {
        path: scenario.branchAt("topic"),
        reason: "unavailable" as const,
        sentence: "Mokly is busy. Try again in a moment.",
        label: "Try again",
      },
      {
        path: scenario.pullAt(buildPullRequest.number),
        reason: "builds-unavailable" as const,
        sentence: "This project publishes from CI.",
        label: "Publish this pull request",
      },
    ]) {
      double.refuseRequest = { reason: refused.reason };
      await open(page, refused.path);
      await page.getByTestId("stage-publish").click();
      await expect(fragment.locator(":scope > [role=alert]")).toHaveText(
        refused.sentence,
      );
      await expect(control).toHaveText(refused.label);
      await expect(
        row.getByRole("link", { name: "Publish from CI" }),
      ).toHaveCount(1);
      await expect(
        row.getByRole("link", { name: "Publish from CI" }),
      ).toHaveAttribute("href", ciGuide);
      await expect(fragment.locator(":scope > details")).toContainText(
        "Details",
      );
      expect(await state.evaluate(refusalLayout, publishRefusal)).toEqual({
        outside: [],
        inside: ["details", "guide"],
        order: ["refusal above the control", "control above the reference"],
        guide: "beside the control",
      });
      expect(await scrollsSideways(page)).toBe(false);
    }
    expect(double.requests).toEqual([
      { branch: "topic" },
      { pullRequest: buildPullRequest.number },
    ]);
  },
};

/**
 * A pull request's Try again refused because it closed or comes from a fork
 * keeps its own label, says why, and adds no guide.
 */
export const tryAgainRefused: BuildStateRow = {
  title: "a refused Try again says why a pull request cannot build",
  label: "try-again-refused",
  run: async (page, scenario) => {
    const action = page.locator(".fo-build-action");
    const fragment = action.locator(":scope > .fo-write-failure");
    for (const [index, kind] of (["closed", "fork"] as const).entries()) {
      const id = buildId(20 + index);
      await refuseTryAgain(page, scenario, id, kind);
      // The write-failure fragment fills the action column, with the refusal
      // above the control and Details beneath. No refusal adds a guide, so
      // the control stands alone.
      await expect(fragment).toHaveCount(1);
      await expect(
        action.locator(".fo-state-pair, .review-inline, .fo-control-guide"),
      ).toHaveCount(0);
      await expect(fragment.locator(":scope > [role=alert]")).toHaveText(
        refusals[kind].sentence,
      );
      await expect(fragment.getByTestId("build-try-again")).toHaveText(
        "Try again",
      );
      await expect(fragment.locator(":scope > details")).toContainText(
        "Details",
      );
      await expect(action.getByRole("link")).toHaveCount(0);
      expect(
        await buildCard(page).evaluate(refusalLayout, buildRefusal),
      ).toEqual({
        outside: [],
        inside: ["details"],
        order: ["refusal above the control", "control above the reference"],
        guide: "none",
      });
      expect(await scrollsSideways(page)).toBe(false);
      await expect(page).toHaveURL(
        (url) => url.pathname === scenario.buildAt(id),
      );
    }
    expect(scenario.double.requests).toEqual([
      { pullRequest: buildPullRequest.number },
      { pullRequest: buildPullRequest.number },
    ]);
  },
};

/** A build card's refused Cancel, in the card's head. */
const cancelRefusal: RefusalParts = {
  head: ".fo-build-head *",
  fragment: ".fo-build-action .fo-write-failure",
  control: "[data-testid=build-cancel]",
};

/**
 * A Cancel refused while Mokly is busy, or failed in the browser, reports its
 * cause above the control and still reads Cancel, because Try again on a build
 * card requests a new build; pressed again, it cancels the build.
 */
export const cancelRefused: BuildStateRow = {
  title: "a refused or failed Cancel keeps its label",
  label: "cancel-refused",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const id = buildId(22);
    double.builds.set(id, build({ id, projectId }));
    await open(page, scenario.buildAt(id));
    const fragment = page.locator(cancelRefusal.fragment);
    const cancel = page.getByTestId("build-cancel");

    double.refuseCancel = "unavailable";
    await cancel.click();
    await expect(fragment.locator(":scope > [role=alert]")).toHaveText(
      "Mokly is busy. Try again in a moment.",
    );
    await expect(fragment.getByTestId("build-cancel")).toHaveText("Cancel");
    await expect(fragment.locator(":scope > details")).toContainText("Details");
    expect(
      await buildCard(page).evaluate(refusalLayout, cancelRefusal),
    ).toEqual({
      outside: [],
      inside: ["details"],
      order: ["refusal above the control", "control above the reference"],
      guide: "none",
    });
    await expect(cardTitle(page, "Publishing this branch")).toBeVisible();
    await expect(buildCard(page).getByRole("status")).toHaveText("");

    // A request the browser could not send never reaches Mokly. It fails the
    // same way, with the sentence of a Mokly that cannot be reached for now.
    const cancelRequest = "**/v1/projects/*/builds/*/cancel";
    await page.route(cancelRequest, (route) => route.abort());
    const failed = page.waitForEvent("requestfailed", (request) =>
      request.url().endsWith("/cancel"),
    );
    await cancel.click();
    await failed;
    await expect(cancel).toHaveText("Cancel");
    await expect(fragment.locator(":scope > [role=alert]")).toHaveText(
      "Mokly is busy. Try again in a moment.",
    );
    expect(double.cancels).toEqual([id]);
    await page.unroute(cancelRequest);

    double.refuseCancel = undefined;
    await cancel.click();
    await expect(cardTitle(page, "Publishing was cancelled")).toBeFocused();
    await expect(page.getByTestId("build-cancel")).toHaveCount(0);
    expect(double.cancels).toEqual([id, id]);
  },
};

/**
 * A request for a head that is already publishing opens that build, from the
 * publishing card; one for a head already published opens that publication,
 * from a failed build's Try again.
 */
export const answered: BuildStateRow = {
  title: "a request already answered opens the build or publication",
  label: "answered",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const active = buildId(23);
    double.builds.set(active, build({ id: active, projectId }));
    double.branches = [branchRow("topic")];
    double.refuseRequest = {
      reason: "build-already-active",
      data: { buildId: active },
    };
    await open(page, scenario.branchAt("topic"));
    await page.getByTestId("stage-publish").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(active));
    await expect(cardTitle(page, "Publishing this branch")).toBeVisible();
    await expect(page.locator(".fo-write-failure")).toHaveCount(0);

    const failed = buildId(24);
    double.builds.set(
      failed,
      build({
        id: failed,
        projectId,
        state: "failed",
        canCancel: false,
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    );
    const token = await createToken(page, projectId);
    const made = await publish(token, projectId, { branch: "topic" });
    double.refuseRequest = {
      reason: "build-already-published",
      data: { publicationId: made.id },
    };
    await open(page, scenario.buildAt(failed));
    await page.getByTestId("build-try-again").click();
    await page.waitForURL((url) =>
      url.pathname.endsWith("/publications/" + made.id),
    );
    await publishedViewerReady(page);
    expect(double.requests).toEqual([{ branch: "topic" }, { branch: "topic" }]);
  },
};
