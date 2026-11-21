import type { Page } from "@playwright/test";

import { settingsPath } from "../navigation/paths";

import { apiFailure } from "./api-responses";
import { write } from "./build-double";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { branchRow, build, buildId, summary } from "./viewer/build-fixtures";
import { pressWrite } from "./writes";

/**
 * What a phone adds to the shared build state table, which
 * `build-states-mobile.spec.ts` runs here: a running card at 390px and 320px,
 * a reference's running build at its alias, the compact Automatic builds
 * switch, and a workspace read a plan refusal could not make.
 */

/** How far the document scrolls sideways; anything but zero is a defect. */
function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

test("a build card fits a phone, with its steps, output and action", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile");
  const { double, projectId } = scenario;
  const id = buildId(400);
  double.builds.set(id, build({ id, projectId }));
  write(double, id, [
    { text: "$ npm ci\n", stream: "system", step: "install" },
    {
      text: "npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.\n",
      stream: "stderr",
      step: "install",
    },
  ]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page, scenario.buildAt(id));
    await expect(
      page.getByRole("heading", { name: "Publishing this branch" }),
    ).toBeVisible();
    await expect(page.locator('[data-mkc-build-step="install"]')).toContainText(
      "Running",
    );
    await expect(page.getByTestId("build-output")).toContainText(
      "leaks memory",
    );
    await expect(page.getByTestId("build-cancel")).toBeVisible();
    expect(await sidewaysOverflow(page), `no overflow at ${width}px`).toBe(0);
  }
  // The compact bar keeps the publication and its state.
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");
});

test("a phone shows the reference's running build at its alias", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-alias");
  const { double, projectId } = scenario;
  const running = buildId(421);
  double.builds.set(running, build({ id: running, projectId }));
  double.branches = [
    branchRow("topic", { newestBuild: summary({ id: running }) }),
  ];
  await open(page, scenario.branchAt("topic"));
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");
  expect(await sidewaysOverflow(page)).toBe(0);
});

test("the compact project pane carries the Automatic builds switch", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-switch");
  const { double } = scenario;
  double.project = {
    buildsAvailable: true,
    canRequestBuilds: true,
    automaticBuilds: false,
  };
  double.acceptUpdates = true;
  await open(
    page,
    settingsPath({
      pane: "project",
      workspaceSlug: scenario.address.workspaceSlug,
      projectSlug: scenario.address.slug,
    }),
  );
  const toggle = page.getByTestId("automatic-builds");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await pressWrite(page, toggle, "PATCH", `/v1/projects/${scenario.projectId}`);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(double.updates).toHaveLength(1);
  expect(await sidewaysOverflow(page)).toBe(0);
});

test("a phone retries a workspace a plan refusal could not read", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-plan");
  const { double, projectId } = scenario;
  const id = buildId(450);
  double.builds.set(
    id,
    build({
      id,
      projectId,
      state: "failed",
      step: null,
      canCancel: false,
      failure: { step: null, cause: "plan-required", exitCode: null },
    }),
  );
  const workspaceRead = "**/v1/workspaces/*";
  await page.route(workspaceRead, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const failure = apiFailure("unavailable");
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
  await open(page, scenario.buildAt(id));
  await expect(page.getByText("This workspace couldn’t load")).toBeVisible();
  await expect(page.getByText("Ask an owner to upgrade to Team.")).toHaveCount(
    0,
  );
  expect(await sidewaysOverflow(page)).toBe(0);
  await page.unroute(workspaceRead);
  await page.getByTestId("stage-retry").click();
  await expect(page.getByTestId("build-open-billing")).toBeVisible();
});
