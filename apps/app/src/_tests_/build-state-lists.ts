import { cardTitle } from "./build-state-parts";
import type { BuildStateRow } from "./build-state-parts";
import { expect, open } from "./harness";
import {
  attempt,
  branchRow,
  build,
  buildId,
  buildPullRequest,
  pullRow,
  summary,
} from "./viewer/build-fixtures";
import { publication } from "./viewer/fixtures";

/**
 * The rows of the shared build state table for builds in the viewer's lists:
 * History names a build in the words a publication uses, and a switcher row
 * takes its state from the newer of its publication and its build.
 */

/** A head whose short SHA a row names. */
const failedHead = "8b3f0c2a6e91d47b3c05f8a2e6d19b47c3a0f5e8";

/**
 * History lists a running build as Publishing now with no Details, because the
 * stage already shows it, and a failed build as Unable to publish with Details,
 * which opens the failed build.
 */
export const history: BuildStateRow = {
  title: "History lists builds in the words publications use",
  label: "history",
  run: async (page, scenario, surface) => {
    const { double, projectId } = scenario;
    const running = buildId(30);
    const failed = buildId(31);
    double.builds.set(running, build({ id: running, projectId }));
    double.builds.set(
      failed,
      build({
        id: failed,
        projectId,
        state: "failed",
        headSha: failedHead,
        canCancel: false,
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    );
    double.history = [
      { kind: "build", build: build({ id: running, projectId }) },
      {
        kind: "publication",
        publication: publication({ id: "p-ready", branch: "topic" }),
      },
      { kind: "build", build: double.builds.get(failed)! },
    ];
    await open(page, scenario.buildAt(running));
    await surface.openHistory(page);
    const panel = page.getByTestId("viewer-panel-history");
    const rows = panel.getByRole("listitem");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Publishing now");
    await expect(rows.nth(0).getByText("Details")).toHaveCount(0);
    await expect(rows.nth(1)).toContainText("Ready");
    await expect(rows.nth(2)).toContainText("Unable to publish");
    await expect(rows.nth(2)).toContainText("8b3f0c2");
    await rows.nth(2).getByText("Details").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(failed));
    await expect(
      cardTitle(page, "Unable to publish this branch"),
    ).toBeVisible();
  },
};

/**
 * Switcher rows read the newer of their publication and their build, with the
 * short SHA of whichever they read. Details on a row whose newest build failed
 * opens that build's address, even for a closed pull request, whose own
 * address shows the closed card.
 */
export const switcher: BuildStateRow = {
  title: "switcher rows read their newest build, and Details opens it",
  label: "switcher",
  run: async (page, scenario) => {
    const { double, projectId } = scenario;
    const failed = buildId(32);
    const closed = buildId(33);
    double.builds.set(
      failed,
      build({
        id: failed,
        projectId,
        state: "failed",
        canCancel: false,
        failure: { step: "publish", cause: "upload-rejected", exitCode: 1 },
      }),
    );
    double.builds.set(
      closed,
      build({
        id: closed,
        projectId,
        state: "failed",
        pullRequest: buildPullRequest,
        canCancel: false,
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    );
    double.branches = [
      branchRow("main", {
        latestPublicationId: "p-ready",
        newestPublication: attempt(),
        newestBuild: summary({
          headSha: "5d2e9a1c3f7b48e09a6d21c4b8f03e7a5d9c1b62",
        }),
      }),
      branchRow("topic", {
        newestBuild: summary({
          id: failed,
          state: "failed",
          headSha: failedHead,
        }),
      }),
    ];
    double.pullRequests = [
      pullRow({
        state: "closed",
        newestBuild: summary({
          id: closed,
          state: "failed",
          headSha: build().headSha,
        }),
      }),
    ];
    const panel = page.getByTestId("viewer-panel-switcher");
    const row = (name: string) =>
      panel.getByRole("listitem").filter({ hasText: name });

    await open(page, scenario.buildAt(failed));
    await page.getByTestId("viewer-publication").click();
    await expect(row("main")).toContainText("Publishing now");
    await expect(row("main")).toContainText("5d2e9a1");
    await expect(row("topic")).toContainText("Unable to publish");
    await expect(row("topic")).toContainText("8b3f0c2");
    await expect(row("#14")).toContainText("octocat · Unable to publish");
    await row("topic").getByText("Details").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(failed));
    await expect(page.locator(".fo-build-line")).toHaveText(
      "Mokly couldn’t accept this catalogue.",
    );

    // The closed pull request's own address shows its closed card, so its
    // Details opens the failed build itself.
    await page.getByTestId("viewer-publication").click();
    await row("#14").getByText("Details").click();
    await page.waitForURL((url) => url.pathname === scenario.buildAt(closed));
    await expect(
      cardTitle(page, "Unable to publish this pull request"),
    ).toBeVisible();
    await open(page, scenario.pullAt(buildPullRequest.number));
    await expect(
      page.getByRole("heading", { name: "This pull request is closed" }),
    ).toBeVisible();
  },
};
