import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import { fulfillScopedShell } from "./scoped_shell_fixture.js";

const actionRoute = "/view/components/action.html";
const handbookRoute = "/view/handbook.html";
const tourRoute = "/view/user-flows/example-tour.html";
const welcomeRoute = "/view/screens/welcome.html";

let developmentBundle: string;
let developmentHostBundle: string;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
  const result = await build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"development"' },
    entryPoints: [path.resolve("src/client/react_host.ts")],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "es2023",
    write: false,
  });
  developmentHostBundle = result.outputFiles[0]?.text ?? "";
  expect(developmentHostBundle).toContain("react-dom-client.development.js");
});

test("use-case and page frames keep loading and navigating while evidence is unavailable", async ({
  page,
}) => {
  const tour = latch();
  let tourRequests = 0;
  let handbookRequests = 0;
  await page.route("**/view/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const evidence = route.request().resourceType() === "fetch";
    if (evidence && pathname === tourRoute) {
      tourRequests += 1;
      tour.markRequested();
      await tour.wait;
    }
    if (evidence && pathname === handbookRoute) {
      handbookRequests += 1;
      await route.abort("failed");
      return;
    }
    await fulfillScopedShell(route);
  });
  await page.goto(actionRoute);
  await expectHydrated(page);

  await page.locator(`[data-mokly-nav] a[href="${tourRoute}"]`).click();
  await tour.requested;
  const flowFrame = page.frameLocator(".mbk-flow-screen iframe").first();
  const details = flowFrame.getByRole("link", {
    name: "View details",
    exact: true,
  });
  await expect(details).toBeVisible();
  await details.click();
  tour.release();
  await expect(page).toHaveURL(
    /\/view\/screens\/details\.html\?fragment=details$/,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(
    page.getByRole("alert").filter({ hasText: "Usage couldn’t be loaded." }),
  ).toHaveCount(0);
  expect(tourRequests).toBe(1);

  await page.locator(`[data-mokly-nav] a[href="${handbookRoute}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${handbookRoute}$`));
  await expect.poll(() => handbookRequests).toBe(1);
  const pageFrame = page.frameLocator(".mbk-stage-embed iframe");
  await expect(
    pageFrame.getByRole("heading", { name: "Getting started" }),
  ).toBeVisible();
  await pageFrame.getByRole("link", { name: "Open Welcome" }).click();
  await expect(page).toHaveURL(new RegExp(`${welcomeRoute}$`));
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.unrouteAll({ behavior: "wait" });
});

test("development React hydrates a scoped live page with initial Usage ready", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await recordLoadingFlash(page);
  await installDevelopmentBundle(page, developmentBundle);
  await page.route("**/__mokly/client/react-host.js", (route) =>
    route.fulfill({
      body: developmentHostBundle,
      contentType: "text/javascript",
    }),
  );
  await page.goto(actionRoute);
  await expectCleanHydration(page, errors, "scoped live hydration");
  const bootstrap = await page
    .locator("script[data-mokly-shell-bootstrap]")
    .textContent();
  expect(bootstrap).toContain('"status":"omitted"');

  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage.getByRole("heading", { name: /Used by/ })).toBeVisible();
  await expect(usage).not.toContainText("Loading usage…");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-saw-usage-loading",
    "",
  );
  await page.unrouteAll({ behavior: "wait" });
});

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

async function recordLoadingFlash(page: Page) {
  await page.addInitScript(() => {
    const inspect = () => {
      if (document.body?.textContent?.includes("Loading usage…"))
        document.documentElement?.setAttribute("data-saw-usage-loading", "");
    };
    new MutationObserver(inspect).observe(document, {
      childList: true,
      subtree: true,
    });
  });
}
