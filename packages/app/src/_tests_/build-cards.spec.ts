import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * A failure cause's sentence on the desktop card. Every cause's sentence and
 * every state's title are checked in `viewer/build-copy.test.ts`. The card's
 * states, actions and refusals are rows of the shared build state table, which
 * `build-states.spec.ts` and `build-states-mobile.spec.ts` run on both
 * surfaces.
 */

test("a failure says its cause in one sentence, with Try again", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-causes");
  const { double, projectId } = scenario;
  const id = buildId(10);
  const line = "Update @mokly/mokly to 0.18.0 or later to publish.";
  double.builds.set(
    id,
    build({
      id,
      projectId,
      state: "failed",
      canCancel: false,
      finishedAt: "2026-09-15T16:40:00Z",
      step: "publish",
      failure: {
        step: "publish",
        cause: "unsupported-mokly-version",
        exitCode: null,
      },
    }),
  );
  await open(page, scenario.buildAt(id));
  const card = page.locator(".fo-build");
  await expect(
    card.getByRole("heading", { name: "Unable to publish this branch" }),
  ).toBeVisible();
  await expect(page.locator(".fo-build-line")).toHaveText(line);
  await expect(page.getByRole("alert").filter({ hasText: line })).toBeVisible();
  await expect(page.getByTestId("build-try-again")).toHaveText("Try again");
  await expect(page.locator(".fo-top-state")).toContainText(
    "Unable to publish",
  );
  // The version sentence names the package as code.
  await expect(page.locator(".fo-build-line code")).toHaveText("@mokly/mokly");
});
