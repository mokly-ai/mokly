import type { Page } from "@playwright/test";

import { buildScenario } from "./build-scenario";
import { apiFailure, expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * A build the plan refused, read by an owner, by everyone else, and while the
 * workspace read that tells them apart is still running or has failed.
 */

/** The build a free workspace's private project could not publish. */
function planRefused(id: string, projectId: string) {
  return build({
    id,
    projectId,
    state: "failed",
    step: null,
    canCancel: false,
    failure: { step: null, cause: "plan-required", exitCode: null },
  });
}

/** Hold or refuse the project's workspace read while a test needs to. */
async function holdWorkspace(
  page: Page,
  answer: () => Promise<"continue" | "fail">,
): Promise<void> {
  await page.route("**/v1/workspaces/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if ((await answer()) === "continue") return route.continue();
    const failure = apiFailure("unavailable");
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
}

test("a plan refusal offers an owner Billing and asks everyone else", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-plan");
  const { double, projectId } = scenario;
  const id = buildId(230);
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
  await open(page, scenario.buildAt(id));
  await expect(
    page.getByRole("heading", {
      name: "Publishing to private projects is on Team",
    }),
  ).toBeVisible();
  for (const step of ["checkout", "install", "publish"]) {
    await expect(page.locator(`[data-mkc-build-step="${step}"]`)).toContainText(
      "Not run",
    );
  }
  await page.getByTestId("build-open-billing").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/settings=billing/);

  await page.route("**/v1/workspaces/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const answer = await route.fetch();
    const body = (await answer.json()) as { role: string };
    return route.fulfill({
      response: answer,
      json: { ...body, role: "admin" },
    });
  });
  await open(page, scenario.buildAt(id));
  await expect(page.locator(".fo-build-line")).toHaveText(
    "Ask an owner to upgrade to Team.",
  );
  await expect(page.getByTestId("build-open-billing")).toHaveCount(0);
});

test("a plan refusal waits for the workspace and retries a failed read", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-plan-read");
  const { double, projectId } = scenario;
  const id = buildId(231);
  double.builds.set(id, planRefused(id, projectId));
  const title = page.getByRole("heading", {
    name: "Publishing to private projects is on Team",
  });
  const billing = page.getByTestId("build-open-billing");

  // While the read runs, the card says nothing owner-specific. The owner's
  // action waits in its own place, and screen readers hear the read.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  await holdWorkspace(page, async () => {
    await held;
    return "continue";
  });
  await open(page, scenario.buildAt(id));
  await expect(title).toBeVisible();
  await expect(page.locator(".fo-build-line")).toHaveCount(0);
  await expect(billing).toHaveCount(0);
  await expect(page.locator(".fo-build-action").getByRole("status")).toHaveText(
    "Checking publishing access…",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  release();
  await expect(billing).toBeVisible();
  await page.unroute("**/v1/workspaces/*");

  // A read that fails for another reason than not-found may hide an owner, so
  // the card gives way to the workspace's own Try again.
  await holdWorkspace(page, async () => "fail");
  await open(page, scenario.buildAt(id));
  const canvas = page.locator(".fo-stage-canvas");
  await expect(canvas.getByText("This workspace couldn’t load")).toBeVisible();
  await expect(page.locator(".fo-build")).toHaveCount(0);
  await expect(page.getByText("Ask an owner to upgrade to Team.")).toHaveCount(
    0,
  );
  await expect(page.locator(".fo-top-state")).toContainText(
    "Unable to publish",
  );
  await page.unroute("**/v1/workspaces/*");
  await canvas.getByTestId("stage-retry").click();
  await expect(title).toBeVisible();
  await expect(billing).toBeVisible();
});
