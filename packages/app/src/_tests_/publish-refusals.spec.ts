import type { Page } from "@playwright/test";

import {
  publishRefusal,
  refusalLayout,
  scrollsSideways,
} from "./build-refusals";
import type { BuildScenario } from "./build-scenario";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { branchRow, buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * The publishing card's refused request on the desktop, as
 * `product/viewer/standalone/publish-refused` and its `pull-request` variant
 * draw it: the write-failure fragment holds the shared control with guide, so
 * Publish from CI stays beside the control, between the refusal and Details.
 */

/** Press the publishing card's control and wait for its refusal. */
async function refusePublish(
  page: Page,
  scenario: BuildScenario,
  path: string,
  refusal: NonNullable<BuildScenario["double"]["refuseRequest"]>,
  sentence: string,
): Promise<void> {
  scenario.double.refuseRequest = refusal;
  await open(page, path);
  await page.getByTestId("stage-publish").click();
  await expect(
    page.locator(".fo-state-action > .fo-write-failure > [role=alert]"),
  ).toHaveText(sentence);
}

test("a refused publish request keeps its guide beside the control, above Details", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "publish-refused");
  const { double } = scenario;
  const state = page.locator(".fo-stage-card .fo-state");
  const fragment = state.locator(".fo-state-action > .fo-write-failure");
  const row = fragment.locator(":scope > .fo-control-guide");
  const layout = {
    outside: [],
    inside: ["details", "guide"],
    order: ["refusal above the control", "control above the reference"],
    guide: "beside the control",
  };

  // Mokly was busy: the same request can succeed, so the control reads the
  // way back.
  double.branches = [branchRow("topic")];
  await refusePublish(
    page,
    scenario,
    scenario.branchAt("topic"),
    { reason: "unavailable" },
    "Mokly is busy. Try again in a moment.",
  );
  await expect(row.getByTestId("stage-publish")).toHaveText("Try again");
  await expect(
    row.getByRole("link", { name: "Publish from CI" }),
  ).toHaveAttribute("href", /\/docs\/ci\/publish-from-ci\/$/);
  await expect(fragment.locator(":scope > details")).toContainText("Details");
  expect(await state.evaluate(refusalLayout, publishRefusal)).toEqual(layout);
  expect(await scrollsSideways(page)).toBe(false);

  // The project no longer builds: the same request would be refused again,
  // so the control keeps its own label.
  double.pullRequests = [pullRow()];
  await refusePublish(
    page,
    scenario,
    scenario.pullAt(buildPullRequest.number),
    { reason: "builds-unavailable" },
    "This project publishes from CI.",
  );
  await expect(row.getByTestId("stage-publish")).toHaveText(
    "Publish this pull request",
  );
  await expect(row.getByRole("link", { name: "Publish from CI" })).toHaveCount(
    1,
  );
  expect(await state.evaluate(refusalLayout, publishRefusal)).toEqual(layout);
  expect(double.requests).toEqual([
    { branch: "topic" },
    { pullRequest: buildPullRequest.number },
  ]);
});

test("the publishing card at rest sets its guide beside the control", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "publish-at-rest");
  scenario.double.branches = [branchRow("topic")];
  await open(page, scenario.branchAt("topic"));
  const action = page.locator(".fo-stage-card .fo-state-action");
  // The write-failure fragment's frame stands around the row at rest, so a
  // refusal never replaces the control. It draws no box of its own.
  const frame = action.locator(":scope > .fo-write-frame");
  await expect(frame).toHaveCSS("display", "contents");
  const row = frame.locator(":scope > .fo-control-guide");
  await expect(row.getByTestId("stage-publish")).toHaveText(
    "Publish this branch",
  );
  await expect(row.getByRole("link", { name: "Publish from CI" })).toHaveCount(
    1,
  );
  await expect(action.locator(".fo-write-failure, details")).toHaveCount(0);
  // The row is centred like the card around it. A part that draws no box,
  // such as the theme provider's `display: contents` wrapper, is measured
  // through to the parts it holds.
  const centred = await row.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const drawn = (element: Element): Element[] =>
      getComputedStyle(element).display === "contents"
        ? [...element.children].flatMap(drawn)
        : [element];
    const parts = [...node.children]
      .flatMap(drawn)
      .map((child) => child.getBoundingClientRect());
    const left = Math.min(...parts.map((part) => part.left)) - box.left;
    const right = box.right - Math.max(...parts.map((part) => part.right));
    return Math.abs(left - right) <= 1;
  });
  expect(centred).toBe(true);
});
