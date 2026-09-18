import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import { reactShellForProject } from "./export_shell.js";
import { startStaticFixture } from "./static_fixture.js";

let developmentBundle: string;
let exported: Awaited<ReturnType<typeof startStaticFixture>>;
let fixtureRoutes: readonly string[];

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
  const manifest: unknown = JSON.parse(
    fs.readFileSync(
      path.resolve("examples/basic/generated/mokly-manifest.json"),
      "utf8",
    ),
  );
  fixtureRoutes = manifestRoutes(manifest);
  expect(fixtureRoutes.length).toBeGreaterThan(80);
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

test("development React hydrates every fixture route cleanly", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page);
  for (const route of fixtureRoutes) {
    const response = await page.goto(`/view/${encodeRoute(route)}`);
    expect(response?.status(), route).toBe(200);
    await expectCleanHydration(page, errors, route);
  }
  await page.route("**/view/not-in-catalogue.html", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(404);
    await route.fulfill({ response, status: 200 });
  });
  for (const fixture of [
    { path: "/", status: 200 },
    { path: "/view/not-in-catalogue.html", status: 200 },
    { path: "/id/example-welcome", status: 200 },
  ]) {
    const response = await page.goto(fixture.path);
    expect(response?.status(), fixture.path).toBe(fixture.status);
    await expectCleanHydration(page, errors, fixture.path);
  }
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
  await page.locator("[data-workspace-scheme]").click();
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
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("mokly:nav-disclosure:v2") ?? "[]"),
      ),
    )
    .toContain("section:pages");
  await page.reload();
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
  errors: string[],
  context = "hydration",
): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(errors, context).toEqual([]);
  errors.length = 0;
}

async function expectNoBrowserErrors(
  page: Page,
  errors: string[],
): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(errors).toEqual([]);
  errors.length = 0;
}

function manifestRoutes(value: unknown): readonly string[] {
  if (!value || typeof value !== "object" || !("entries" in value)) return [];
  const entries = value.entries;
  if (!Array.isArray(entries)) return [];
  return [
    ...new Set(
      entries.flatMap((entry) =>
        entry &&
        typeof entry === "object" &&
        "route" in entry &&
        typeof entry.route === "string"
          ? [entry.route]
          : [],
      ),
    ),
  ];
}

function encodeRoute(route: string): string {
  return route.split("/").map(encodeURIComponent).join("/");
}
