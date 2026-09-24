import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  expectNoBrowserErrors,
  installDevelopmentBundle as installBundle,
} from "./react_shell_hydration_helpers.js";

let developmentBundle: string;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

test("development React hydrates a fresh desktop document cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
});

test("development React hydrates a restored dark appearance cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mokly:theme", "dark");
  });
  await installDevelopmentBundle(page);
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
});

test("development React hydrates navigation and filters as live state", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.goto("/");
  await expectCleanHydration(page, errors);
  const pages = page.locator('[data-nav-section="pages"]');
  await pages.locator(":scope > summary").click();
  await expect(pages).not.toHaveAttribute("open", "");
  await page.locator('[data-filter="changed"]').click();
  await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoBrowserErrors(page, errors);
});

test("development React hydrates the tag picker as live state", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.goto("/");
  await expectCleanHydration(page, errors);
  await page.locator("[data-mokly-tag-toggle]").click();
  await expect(page.locator("#mb-tag-picker")).toBeVisible();
  await page.locator('#mb-tag-picker [data-mokly-tag="forms"]').click();
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expectNoBrowserErrors(page, errors);
});

test("development React hydrates controls and persisted details as live state", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mokly:details-disclosure", "open");
  });
  await installDevelopmentBundle(page);
  await page.goto("/view/screens/welcome.html");
  await expectCleanHydration(page, errors);
  await expect(page.locator("[data-workspace-inspector]")).toHaveAttribute(
    "data-open",
    "true",
  );
  await page.getByLabel("Viewport", { exact: true }).selectOption("mobile");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "mobile",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectNoBrowserErrors(page, errors);
});

test("development React hydrates live component controls before enabling them", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/client/react-shell.js", async (route) => {
    markRequested();
    await released;
    await route.fulfill({
      body: developmentBundle,
      contentType: "text/javascript",
    });
  });
  const navigation = page.goto("/view/components/action.html");
  await requested;
  const props = page.locator('[data-inspector-panel="props"]');
  await expect(props.locator("[data-controls-status]")).toHaveText(
    "Open this catalogue locally to edit props.",
  );
  await expect(props.locator("[data-prop-control]").first()).toBeDisabled();

  release();
  await navigation;
  await expectCleanHydration(page, errors);
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.locator("[data-controls-status]")).toHaveText(
    "Saved props",
  );
  await expect(page.locator("[data-prop-control]").first()).toBeEnabled();
});

test("development React hydrates the mobile drawer as live state", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectCleanHydration(page, errors);
  await page.locator("[data-mokly-menu]").click();
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-drawer",
    "open",
  );
  await expectNoBrowserErrors(page, errors);
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

test("an early native disclosure wins hydration before reload promotes active ancestry", async ({
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
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("mokly:nav-disclosure:v3") ?? "{}"),
      ),
    )
    .toMatchObject({ "section:pages": false });
  await page.reload();
  await expectCleanHydration(page, errors);
  await expect(disclosure).toHaveAttribute("open", "");
});

async function installDevelopmentBundle(page: Page): Promise<void> {
  await installBundle(page, developmentBundle);
}
