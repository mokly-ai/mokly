import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId, buildPullRequest } from "./viewer/build-fixtures";

/**
 * Every failure cause's sentence on the desktop card. The card's states,
 * actions and refusals are rows of the shared build state table, which
 * `build-states.spec.ts` and `build-states-mobile.spec.ts` run on both
 * surfaces.
 */

test("each failure says its cause in one sentence, with Try again", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-causes");
  const { double, projectId } = scenario;
  const cases = [
    {
      over: { failure: { step: "install", cause: "exit", exitCode: 1 } },
      title: "Unable to publish this branch",
      line: "Installing dependencies failed.",
    },
    {
      over: {
        state: "timed-out",
        step: "publish",
        pullRequest: buildPullRequest,
        failure: { step: "publish", cause: "deadline", exitCode: null },
      },
      title: "Unable to publish this pull request",
      line: "The build stopped at its 15-minute limit.",
    },
    {
      over: {
        step: "checkout",
        failure: { step: "checkout", cause: "infrastructure", exitCode: null },
      },
      title: "Unable to publish this branch",
      line: "Mokly couldn’t run this build.",
    },
    {
      over: {
        step: "publish",
        failure: {
          step: "publish",
          cause: "uncommitted-changes",
          exitCode: null,
        },
      },
      title: "Unable to publish this branch",
      line: "The build left files that Git doesn’t ignore; add them to .gitignore.",
    },
    {
      over: {
        step: "publish",
        failure: {
          step: "publish",
          cause: "unsupported-mokly-version",
          exitCode: null,
        },
      },
      title: "Unable to publish this branch",
      line: "Update @mokly/mokly to 0.18.0 or later to publish.",
    },
  ] as const;
  for (const [index, entry] of cases.entries()) {
    const id = buildId(10 + index);
    double.builds.set(
      id,
      build({
        id,
        projectId,
        state: "failed",
        canCancel: false,
        finishedAt: "2026-09-15T16:40:00Z",
        ...entry.over,
      }),
    );
    await open(page, scenario.buildAt(id));
    const card = page.locator(".fo-build");
    await expect(
      card.getByRole("heading", { name: entry.title }),
    ).toBeVisible();
    await expect(page.locator(".fo-build-line")).toHaveText(entry.line);
    await expect(
      page.getByRole("alert").filter({ hasText: entry.line }),
    ).toBeVisible();
    await expect(page.getByTestId("build-try-again")).toHaveText("Try again");
    await expect(page.locator(".fo-top-state")).toContainText(
      "Unable to publish",
    );
  }
  // The version sentence names the package as code.
  await expect(page.locator(".fo-build-line code")).toHaveText("@mokly/mokly");
});
