import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

let developmentBundle: string;

test.beforeAll(async () => {
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
});

for (const preference of [undefined, "closed"] as const) {
  test(`an early Details activation beats ${preference ?? "an absent"} preference`, async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    if (preference)
      await page.addInitScript((value) => {
        if (window !== window.top) return;
        localStorage.setItem("mokly:details-disclosure", value);
      }, preference);
    const gate = await delayHydration(page);
    const navigation = page.goto("/view/handbook.html");
    await gate.requested;
    const details = page.locator("[data-mokly-details]");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");

    gate.release();
    await navigation;

    await expectCleanHydration(page, errors);
    await expect(details).toHaveAttribute("open", "");
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("mokly:details-disclosure")),
      )
      .toBe("open");
  });
}

test("an early navigation disclosure beats reload recovery", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem(
      "mokly:live-update-recovery",
      JSON.stringify({
        url: location.href,
        version: 1,
        browse: {
          changedOnly: false,
          closedCollectionIds: [],
          colorScheme: "light",
          detailsOpen: false,
          drawerOpen: false,
          filterBaselineClosedCollectionIds: null,
          navScroll: 0,
          query: "welcome",
          regionScrolls: {},
          viewport: "both",
        },
      }),
    );
  });
  const gate = await delayHydration(page);
  const navigation = page.goto("/view/screens/welcome.html");
  await gate.requested;
  const pages = page.locator('details[data-nav-disclosure="section:pages"]');
  await pages.locator(":scope > summary").click();
  await expect(pages).not.toHaveAttribute("open", "");

  gate.release();
  await navigation;

  await expectCleanHydration(page, errors);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("welcome");
  await expect(pages).not.toHaveAttribute("open", "");
});

test("Details remains usable for the session when localStorage is unavailable", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  const gate = await delayHydration(page);
  const navigation = page.goto("/view/screens/welcome.html");
  await gate.requested;
  const inspector = page.locator("[data-workspace-inspector]");
  await expect(inspector).not.toHaveAttribute("data-open", "true");

  gate.release();
  await navigation;
  await expectCleanHydration(page, errors);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-open", "true");

  await page
    .locator('a[data-nav-row][data-route="screens/details.html"]')
    .click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(inspector).toHaveAttribute("data-open", "true");
  await expectNoBrowserErrors(page, errors);
});

test("stored closed active ancestry is open for the first React render", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem(
      "mokly:nav-disclosure:v2",
      JSON.stringify([
        "section:pages",
        "collection:pages:example",
        "collection:pages:example-screens",
      ]),
    );
  });
  const gate = await delayHydration(page);
  const navigation = page.goto("/view/screens/welcome.html");
  await gate.requested;
  const pages = page.locator('details[data-nav-disclosure="section:pages"]');
  const example = page.locator(
    'details[data-nav-disclosure="collection:pages:example"]',
  );
  const screens = page.locator(
    'details[data-nav-disclosure="collection:pages:example-screens"]',
  );
  await expect(pages).not.toHaveAttribute("open", "");
  await expect(example).not.toHaveAttribute("open", "");
  await expect(screens).not.toHaveAttribute("open", "");

  gate.release();
  await navigation;

  await expectCleanHydration(page, errors);
  await expect(pages).toHaveAttribute("open", "");
  await expect(example).toHaveAttribute("open", "");
  await expect(screens).toHaveAttribute("open", "");
});

async function delayHydration(page: Page): Promise<{
  release(): void;
  requested: Promise<void>;
}> {
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
  return { release, requested };
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
}
