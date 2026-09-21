import { expect, test } from "@playwright/test";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  delayHydration,
  expectCleanHydration,
  expectNoBrowserErrors,
} from "./react_shell_hydration_helpers.js";

let developmentBundle: string;

test.beforeAll(async () => {
  developmentBundle = await buildDevelopmentBundle();
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
    const gate = await delayHydration(page, developmentBundle);
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
  const gate = await delayHydration(page, developmentBundle);
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
  const gate = await delayHydration(page, developmentBundle);
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
  const gate = await delayHydration(page, developmentBundle);
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
