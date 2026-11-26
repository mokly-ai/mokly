import { publicationPathFor } from "./addresses";
import { installPollClock, nextPoll } from "./build-clock";
import { advance } from "./build-double";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { createToken, publish } from "./publish";
import {
  branchRow,
  build,
  buildId,
  buildPullRequest,
  pullRow,
  summary,
} from "./viewer/build-fixtures";
import { publicationReference } from "./viewer/support";

test("a reference with nothing ready shows its running build", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-alias");
  const { double, projectId } = scenario;
  const id = buildId(100);
  double.builds.set(id, build({ id, projectId }));
  const topic = branchRow("topic", {
    newestBuild: summary({ id, state: "running" }),
  });
  double.branches = [topic];
  await installPollClock(page);
  await open(page, scenario.branchAt("topic"));
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/branches\?branch=topic$/);
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");

  // Once the build has published, the alias resolves to its publication.
  const token = await createToken(page, projectId);
  const published = await publish(token, projectId, { branch: "topic" });
  topic.latestPublicationId = published.id;
  advance(double, id, {
    state: "published",
    publicationId: published.id,
    canCancel: false,
  });
  await nextPoll(page);
  await page.waitForURL((url) =>
    url.pathname.endsWith("/publications/" + published.id),
  );
});

test("an open pull request alias follows its build to the ready publication", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-pull-alias");
  const { double, projectId } = scenario;
  const id = buildId(105);
  const pull = pullRow({ newestBuild: summary({ id, state: "running" }) });
  double.pullRequests = [pull];
  double.builds.set(
    id,
    build({
      id,
      projectId,
      branch: pull.branch,
      pullRequest: buildPullRequest,
    }),
  );
  await installPollClock(page);
  await open(page, scenario.pullAt(buildPullRequest.number));
  await expect(
    page.getByRole("heading", { name: "Publishing this pull request" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === scenario.pullAt(buildPullRequest.number),
  );

  const token = await createToken(page, projectId);
  const published = await publish(token, projectId, {
    branch: pull.branch,
    pullRequest: buildPullRequest.number,
  });
  pull.latestPublicationId = published.id;
  advance(double, id, {
    state: "published",
    publicationId: published.id,
    canCancel: false,
  });
  await nextPoll(page);
  await expect(page).toHaveURL(
    await publicationPathFor(page, projectId, published.id),
  );
  await expect(
    page.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
});

test("the standalone entry shows the default branch's first build", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-standalone");
  const { double, projectId } = scenario;
  const id = buildId(110);
  double.builds.set(
    id,
    build({ id, projectId, branch: "main", step: "checkout", baseRef: null }),
  );
  double.branches = [
    branchRow("main", { newestBuild: summary({ id, state: "running" }) }),
  ];
  await open(page, scenario.address.path);
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(publicationReference(page)).toHaveText("main");
  await expect(page.locator('[data-mkc-build-step="checkout"]')).toContainText(
    "Running",
  );
});

test("a pull request shows its build, and offers to publish when it has none", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-pull");
  const { double, projectId } = scenario;
  const id = buildId(120);
  double.builds.set(
    id,
    build({ id, projectId, pullRequest: buildPullRequest, step: "publish" }),
  );
  double.pullRequests = [
    pullRow({ newestBuild: summary({ id, state: "running" }) }),
  ];
  await open(page, scenario.pullAt(buildPullRequest.number));
  await expect(
    page.getByRole("heading", { name: "Publishing this pull request" }),
  ).toBeVisible();
  await expect(page.locator(".fo-build-reference")).toContainText(
    "#14 Host the catalogue",
  );

  const next = buildId(121);
  double.pullRequests = [pullRow()];
  double.nextBuild = build({
    id: next,
    projectId,
    pullRequest: buildPullRequest,
    state: "queued",
    step: null,
  });
  await open(page, scenario.pullAt(buildPullRequest.number));
  await expect(
    page.getByRole("heading", { name: "No publication yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish this pull request" }).click();
  await page.waitForURL((url) => url.pathname === scenario.buildAt(next));
  expect(double.requests).toEqual([{ pullRequest: buildPullRequest.number }]);
});
