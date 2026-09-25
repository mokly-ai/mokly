import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { fulfillScopedShell } from "./scoped_shell_fixture.js";

const actionRoute = "/view/components/action.html";
const toolbarRoute = "/view/components/toolbar.html";
const welcomeRoute = "/view/screens/welcome.html";

test("scoped navigation shows Loading then complete Usage without a false zero", async ({
  page,
}) => {
  const held = latch();
  let requests = 0;
  await page.route("**/view/**", async (route) => {
    if (isEvidenceRequest(route, actionRoute)) {
      requests += 1;
      held.markRequested();
      await held.wait;
    }
    await fulfillScopedShell(route);
  });
  await page.goto(toolbarRoute);
  await expectHydrated(page);
  await recordFalseEmptyState(page);
  await page.locator(`[data-mokly-nav] a[href="${actionRoute}"]`).click();
  await held.requested;
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage).toHaveText("Loading usage…");
  await expect(usage).not.toContainText("No recorded consumers.");
  await markDesktopFrame(page);

  held.release();
  await expect(usage.getByRole("heading", { name: /Used by/ })).toBeVisible();
  await expect(
    usage.getByRole("link", { name: "Welcome", exact: true }),
  ).toBeVisible();
  await expect(usage).not.toContainText("Loading usage…");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-saw-false-usage-empty",
    "",
  );
  await expectDesktopFrameRetained(page);
  expect(requests).toBe(1);
  await page.unrouteAll({ behavior: "wait" });
});

test("failed scoped evidence retries in place and then becomes Ready", async ({
  page,
}) => {
  const retry = latch();
  let requests = 0;
  await page.route("**/view/**", async (route) => {
    if (isEvidenceRequest(route, actionRoute)) {
      requests += 1;
      if (requests === 1) {
        await route.abort("failed");
        return;
      }
      retry.markRequested();
      await retry.wait;
    }
    await fulfillScopedShell(route);
  });
  await page.goto(toolbarRoute);
  await expectHydrated(page);
  await page.locator(`[data-mokly-nav] a[href="${actionRoute}"]`).click();
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage.getByRole("alert")).toHaveText(
    "Usage couldn’t be loaded.",
  );
  await expect(page.locator("[data-workspace-highlight]")).toHaveAttribute(
    "title",
    "Waiting for the component preview.",
  );
  await markDesktopFrame(page);

  await usage.getByRole("button", { name: "Try again" }).click();
  await retry.requested;
  await expect(usage).toHaveText("Loading usage…");
  await expectDesktopFrameRetained(page);
  retry.release();

  await expect(usage.getByRole("heading", { name: /Used by/ })).toBeVisible();
  await expectDesktopFrameRetained(page);
  expect(requests).toBe(2);
  await page.unrouteAll({ behavior: "wait" });
});

for (const failure of ["non-OK response", "rejected candidate"] as const)
  test(`${failure} produces Failed for the current scoped route`, async ({
    page,
  }) => {
    await page.route("**/view/**", async (route) => {
      if (isEvidenceRequest(route, actionRoute)) {
        if (failure === "non-OK response")
          await route.fulfill({ body: "Unavailable", status: 503 });
        else await fulfillScopedShell(route, { kind: "home" });
        return;
      }
      await fulfillScopedShell(route);
    });
    await page.goto(toolbarRoute);
    await expectHydrated(page);
    await page.locator(`[data-mokly-nav] a[href="${actionRoute}"]`).click();
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Usage couldn’t be loaded.",
    );
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeEnabled();
    await page.unrouteAll({ behavior: "wait" });
  });

test("an instance deep link resolves after scoped route evidence adoption", async ({
  page,
}) => {
  const held = latch();
  await page.route("**/view/**", async (route) => {
    if (isEvidenceRequest(route, welcomeRoute)) {
      held.markRequested();
      await held.wait;
    }
    await fulfillScopedShell(route);
  });
  await page.goto(actionRoute);
  await expectHydrated(page);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const link = page
    .getByRole("tabpanel", { name: "Usage", exact: true })
    .getByRole("link", { name: "Welcome", exact: true });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const instance = new URL(href!, "http://mokly.invalid").searchParams.get(
    "instance",
  );
  expect(instance).toMatch(/^[a-f0-9]{64}$/);
  await link.click();
  await held.requested;
  await expect(page).toHaveURL(new RegExp(`instance=${instance}`));
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Components", exact: true }),
  ).toContainText("Waiting for the component preview.");
  await markDesktopFrame(page);

  held.release();
  await expect(
    page.getByRole("tab", { name: "Props", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.locator(`[data-instance-key="${instance}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await expectDesktopFrameRetained(page);
  await page.unrouteAll({ behavior: "wait" });
});

function isEvidenceRequest(route: Route, pathname: string): boolean {
  return (
    route.request().resourceType() === "fetch" &&
    new URL(route.request().url()).pathname === pathname
  );
}

function latch() {
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { markRequested, release, requested, wait };
}

async function expectHydrated(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
}

async function recordFalseEmptyState(page: Page) {
  await page.evaluate(() => {
    const inspect = () => {
      if (document.body.textContent?.includes("No recorded consumers."))
        document.documentElement.dataset.sawFalseUsageEmpty = "";
    };
    new MutationObserver(inspect).observe(document.body, {
      childList: true,
      subtree: true,
    });
    inspect();
  });
}

async function markDesktopFrame(page: Page) {
  await page.locator('[data-workspace-frame="desktop"]').evaluate((frame) => {
    frame.setAttribute("data-scope-frame-retained", "");
  });
}

async function expectDesktopFrameRetained(page: Page) {
  await expect(
    page.locator(
      '[data-workspace-frame="desktop"][data-scope-frame-retained=""]',
    ),
  ).toHaveCount(1);
}
