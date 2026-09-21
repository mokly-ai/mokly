import { expect, test } from "@playwright/test";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import {
  startHistoricalStaticFixture,
  startStaticFixture,
} from "./static_fixture.js";

let developmentBundle: string;
let exported: Awaited<ReturnType<typeof startStaticFixture>>;
let historical: Awaited<ReturnType<typeof startHistoricalStaticFixture>>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
  exported = await startStaticFixture();
  historical = await startHistoricalStaticFixture();
});

test.afterAll(async () => {
  await Promise.all([exported?.close(), historical?.close()]);
});

test("development React hydrates a finalized export cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, developmentBundle);
  await page.goto(`${exported.url}/view/screens/home.html`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
  await expectCleanHydration(page, errors);
});

test("static hydration adopts choices made after load while its catalogue is pending", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(() => {
    if (window === window.top)
      localStorage.setItem("mokly:navigation-width:v1", "360");
  });
  await installDevelopmentBundle(page, developmentBundle);
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/catalogue.json", async (route) => {
    markRequested();
    await released;
    await route.continue();
  });

  const navigation = page.goto(`${exported.url}/view/screens/home.html`);
  await requested;
  await expect
    .poll(() => page.evaluate(() => document.readyState))
    .toBe("complete");
  const disclosure = page.locator(
    'details[data-nav-disclosure="section:pages"]',
  );
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.locator("[data-mokly-nav-resize]")).toHaveAttribute(
    "aria-valuenow",
    "360",
  );
  await disclosure.locator(":scope > summary").click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mokly-hydrated",
    "",
  );

  release();
  await navigation;
  await expectCleanHydration(page, errors);
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-mokly-nav-resize]")).toHaveAttribute(
    "aria-valuenow",
    "360",
  );
});

test("development React hydrates removed and renamed finalized routes", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, developmentBundle);
  for (const route of ["removed.html", "guides/original.html"]) {
    const response = await page.goto(
      `${historical.url}/view/${encodeRoute(route)}`,
    );
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expectCleanHydration(page, errors, route);
  }
});

function encodeRoute(route: string): string {
  return route.split("/").map(encodeURIComponent).join("/");
}
