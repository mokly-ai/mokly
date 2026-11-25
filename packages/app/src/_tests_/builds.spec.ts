import type { Page } from "@playwright/test";

import { holdPolls, nextPoll } from "./build-clock";
import { advance, write } from "./build-double";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { createToken, publish } from "./publish";
import { build, buildId, branchRow } from "./viewer/build-fixtures";
import { publicationReference, publishedViewerReady } from "./viewer/support";

/** One step's column on the build card. */
function steps(page: Page, step: string) {
  return page.locator(`[data-mkc-build-step="${step}"]`);
}

test("Publish this branch follows its build to the published catalogue", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-flow");
  const { double, projectId } = scenario;
  const id = buildId(1);
  double.branches = [branchRow("topic")];
  double.nextBuild = build({
    id,
    projectId,
    branch: "topic",
    state: "queued",
    step: null,
    startedAt: null,
  });

  await holdPolls(page);
  await open(page, scenario.branchAt("topic"));
  const card = page.locator(".fo-stage-card");
  await expect(
    card.getByRole("heading", { name: "No publications yet" }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Publish from CI" }),
  ).toHaveAttribute("href", /\/docs\/ci\/publish-from-ci\/$/);
  await card.getByRole("button", { name: "Publish this branch" }).click();
  await page.waitForURL((url) => url.pathname === scenario.buildAt(id));
  expect(double.requests).toEqual([{ branch: "topic" }]);

  // Queued: every step waits, and Cancel is the card's one, secondary action.
  const build$ = page.locator(".fo-build");
  await expect(
    build$.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(build$).toContainText("Waiting to start.");
  for (const step of ["checkout", "install", "publish"]) {
    await expect(steps(page, step)).toContainText("Waiting");
  }
  await expect(page.getByTestId("build-cancel")).toBeVisible();
  await expect(page.getByTestId("build-output")).toHaveCount(0);
  await expect(publicationReference(page)).toHaveText("topic");
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");

  // The worker starts it: the next read moves the steps and shows output.
  advance(double, id, { state: "running", step: "checkout" });
  write(double, id, [
    { text: "$ git fetch --depth 50 origin\n", stream: "system" },
    { text: "Fetching origin\n" },
  ]);
  await nextPoll(page);
  await expect(steps(page, "checkout")).toContainText("Running");
  const output = page.getByTestId("build-output");
  await expect(output).toContainText("Fetching origin");
  await expect(build$).not.toContainText("Waiting to start.");

  // A later window continues after the last sequence it read.
  advance(double, id, { step: "install" });
  write(double, id, [
    { text: "$ npm ci\n", stream: "system", step: "install" },
    { text: "added 412 packages\n", step: "install" },
  ]);
  await nextPoll(page);
  await expect(output).toContainText("added 412 packages");
  await expect(steps(page, "checkout")).toContainText("Done");
  await expect(steps(page, "install")).toContainText("Running");
  await expect(output.locator(".fo-build-system")).toHaveCount(2);

  // The upload committed a real publication of the branch.
  const token = await createToken(page, projectId);
  const published = await publish(token, projectId, { branch: "topic" });
  advance(double, id, {
    state: "published",
    step: "publish",
    publicationId: published.id,
    finishedAt: new Date().toISOString(),
    canCancel: false,
  });
  write(double, id, [
    { text: "Published\n", stream: "system", step: "publish" },
  ]);
  await nextPoll(page);
  await expect(
    build$.getByRole("heading", { name: "Published this branch" }),
  ).toBeVisible();
  for (const step of ["checkout", "install", "publish"]) {
    await expect(steps(page, step)).toContainText("Done");
  }
  await expect(page.locator(".fo-top-state")).toContainText("Ready · ");
  // A terminal transition never navigates, and the card stops reading. The
  // last line shows once its log read has landed; then more than three poll
  // intervals pass on the page with no read.
  await expect(page).toHaveURL((url) => url.pathname === scenario.buildAt(id));
  await expect(output).toContainText("Published");
  const settled = double.reads.length;
  await page.clock.runFor(10_500);
  expect(double.reads.length, "no read after the log is complete").toBe(
    settled,
  );

  // The published viewer keeps its own time again.
  await page.clock.resume();
  await page.getByTestId("build-open-catalogue").click();
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith("/publications/" + published.id) &&
      url.searchParams.get("view") === "changes",
  );
  await publishedViewerReady(page);
  await expect(publicationReference(page)).toHaveText("topic");
});

test("a hidden tab stops reading and a visible one reads at once", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-hidden");
  const id = buildId(2);
  scenario.double.builds.set(
    id,
    build({ id, projectId: scenario.projectId, state: "running" }),
  );
  await holdPolls(page);
  await open(page, scenario.buildAt(id));
  await expect(page.locator(".fo-build")).toBeVisible();
  // The first read ends with the log, so wait for that read to land.
  await expect
    .poll(() => scenario.double.reads.includes("log:" + id))
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = scenario.double.reads.length;
  write(scenario.double, id, [{ text: "while hidden\n" }]);
  await page.clock.runFor(7_000);
  expect(scenario.double.reads.length, "a hidden tab reads nothing").toBe(
    hidden,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("build-output")).toContainText("while hidden", {
    timeout: 2_500,
  });
});

test("a poll that fails keeps the card and the output as they are", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-poll-failure");
  const { double } = scenario;
  const id = buildId(3);
  double.builds.set(id, build({ id, projectId: scenario.projectId }));
  write(double, id, [{ text: "installing\n", step: "install" }]);
  await holdPolls(page);
  await open(page, scenario.buildAt(id));
  const output = page.getByTestId("build-output");
  await expect(output).toContainText("installing");

  double.failBuild = "unavailable";
  double.failLog = "unavailable";
  advance(double, id, {
    state: "failed",
    failure: { step: "install", cause: "exit", exitCode: 1 },
  });
  const failing = double.reads.length;
  await nextPoll(page);
  await expect.poll(() => double.reads.length).toBeGreaterThan(failing + 1);
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(output).toContainText("installing");
  await expect(page.getByText("This build couldn’t load")).toHaveCount(0);

  // The next read that succeeds moves the card.
  double.failBuild = undefined;
  double.failLog = undefined;
  await nextPoll(page);
  await expect(
    page.getByRole("heading", { name: "Unable to publish this branch" }),
  ).toBeVisible();
  await expect(page.locator(".fo-build-message")).toHaveAttribute(
    "role",
    "alert",
  );
  await expect(page.locator(".fo-build")).toContainText(
    "Installing dependencies failed.",
  );
});
