import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import { reactShellForProject } from "./export_shell.js";
import { startStaticFixture } from "./static_fixture.js";

let developmentBundle: string;
let exported: Awaited<ReturnType<typeof startStaticFixture>>;

test.beforeAll(async ({ browser: _browser }, info) => {
  test.setTimeout(120_000);
  const result = await build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"development"' },
    entryPoints: [path.resolve("packages/viewer/src/browser.tsx")],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "es2023",
    write: false,
  });
  developmentBundle = result.outputFiles[0]?.text ?? "";
  expect(developmentBundle).toContain("react-dom-client.development.js");
  const reactShell = reactShellForProject(info.project.name);
  expect(reactShell).toBe(true);
  exported = await startStaticFixture({ reactShell });
});

test.afterAll(async () => exported?.close());

test("development React hydrates a fresh desktop document cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
});

test("development React hands persisted navigation width off after hydration", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mokly:navigation-width:v1", "360");
  });
  await installDevelopmentBundle(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
  await expect(page.locator("[data-mokly-nav-resize]")).toHaveAttribute(
    "aria-valuenow",
    "360",
  );
  await expect
    .poll(() =>
      page
        .locator("[data-mokly-nav]")
        .evaluate((nav) => nav.style.getPropertyValue("--mbk-nav-width")),
    )
    .toBe("360px");
});

test("development React hydrates a mobile document cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
});

test("an early native disclosure choice wins during development hydration", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  let bundleRequested = () => {};
  const requested = new Promise<void>((resolve) => {
    bundleRequested = resolve;
  });
  let releaseBundle = () => {};
  const released = new Promise<void>((resolve) => {
    releaseBundle = resolve;
  });
  await page.route("**/__mokly/client/react-shell.js", async (route) => {
    bundleRequested();
    await released;
    await route.fulfill({
      body: developmentBundle,
      contentType: "text/javascript",
    });
  });
  const navigation = page.goto("/view/screens/welcome.html");
  await requested;
  const disclosure = page.locator(
    'details[data-nav-disclosure="section:pages"]',
  );
  await expect(disclosure).toHaveAttribute("open", "");
  await disclosure.locator(":scope > summary").click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  releaseBundle();
  await navigation;
  await expectCleanHydration(page, errors);
  await expect(disclosure).not.toHaveAttribute("open", "");
});

test("development React hydrates a finalized export cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.goto(`${exported.url}/view/screens/home.html`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
  await expectCleanHydration(page, errors);
});

async function installDevelopmentBundle(page: Page): Promise<void> {
  await page.route("**/__mokly/client/react-shell.js", (route) =>
    route.fulfill({
      body: developmentBundle,
      contentType: "text/javascript",
    }),
  );
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const sandboxDiagnostic =
      message.location().url.includes("/static/") &&
      message.text().startsWith("Blocked script execution in");
    if (!sandboxDiagnostic) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectCleanHydration(
  page: Page,
  errors: readonly string[],
): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(errors).toEqual([]);
}
