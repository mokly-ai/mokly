import {
  buildRefusal,
  refusalLayout,
  refusals,
  refuseTryAgain,
  scrollsSideways,
} from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId, buildPullRequest } from "./viewer/build-fixtures";

/**
 * A refused Try again on the desktop, as
 * `product/viewer/standalone/build/refused` draws it: the write-failure
 * fragment fills the action column, with the refusal above the control and
 * Details beneath. No refusal adds a guide, so the control stands alone.
 */

test("a refused Try again stands alone between its refusal and Details", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-refused");
  const action = page.locator(".fo-build-action");
  const fragment = action.locator(":scope > .fo-write-failure");
  for (const [index, kind] of (["closed", "fork"] as const).entries()) {
    const refusal = refusals[kind];
    await refuseTryAgain(page, scenario, buildId(70 + index), kind);
    await expect(fragment).toHaveCount(1);
    await expect(
      action.locator(".fo-state-pair, .review-inline, .fo-control-guide"),
    ).toHaveCount(0);
    await expect(fragment.locator(":scope > [role=alert]")).toHaveText(
      refusal.sentence,
    );
    await expect(fragment.locator(":scope > details")).toContainText("Details");
    // The control keeps its own label: the same request would be refused.
    await expect(fragment.getByTestId("build-try-again")).toHaveText(
      "Try again",
    );
    await expect(action.getByRole("link")).toHaveCount(0);
    expect(
      await page.locator(".fo-build").evaluate(refusalLayout, buildRefusal),
    ).toEqual({
      outside: [],
      inside: ["details"],
      order: ["refusal above the control", "control above the reference"],
      guide: "none",
    });
    expect(await scrollsSideways(page)).toBe(false);
  }
  expect(scenario.double.requests).toEqual([
    { pullRequest: buildPullRequest.number },
    { pullRequest: buildPullRequest.number },
  ]);
});

test("a Try again at rest stands alone in the action column", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-try-again-alone");
  const { double, projectId } = scenario;
  const id = buildId(72);
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
  await open(page, scenario.buildAt(id));
  const action = page.locator(".fo-build-action");
  await expect(action.getByTestId("build-try-again")).toHaveText("Try again");
  await expect(
    action.locator(
      ".fo-state-pair, .review-inline, .fo-control-guide, .fo-write-failure",
    ),
  ).toHaveCount(0);
  await expect(action.getByRole("link")).toHaveCount(0);
});
