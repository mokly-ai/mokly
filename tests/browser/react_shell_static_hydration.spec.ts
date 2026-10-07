import { expect, test } from "@playwright/test";
import type { CDPSession } from "@playwright/test";

import { readCatalogue } from "@mokly/viewer";

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
  await page.goto(`${exported.url}/view/home/`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
  await expectCleanHydration(page, errors);
});

test("static hydration validates its shared catalogue exactly once", async ({
  context,
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, developmentBundle);
  const session = await context.newCDPSession(page);
  await session.send("Profiler.enable");
  await session.send("Profiler.startPreciseCoverage", {
    callCount: true,
    detailed: true,
  });
  try {
    await page.goto(`${exported.url}/view/home/`);
    await expectCleanHydration(page, errors);
    expect(await functionCalls(session, "readCatalogue")).toBe(1);
  } finally {
    await session.send("Profiler.stopPreciseCoverage");
  }
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
  await page.route("**/mokly-viewer/catalogue.json", async (route) => {
    markRequested();
    await released;
    await route.continue();
  });

  const navigation = page.goto(`${exported.url}/view/home/`);
  await requested;
  await expect
    .poll(() => page.evaluate(() => document.readyState))
    .toBe("complete");
  const disclosure = page.locator(
    'details[data-nav-disclosure="section:specs"]',
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

test("development React hydrates removed and moved finalized routes", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, developmentBundle);
  const removed = await page.goto(`${historical.url}/view/removed/`);
  expect(removed?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expectCleanHydration(page, errors, "removed/index.html");

  const current = await page.goto(`${historical.url}/view/renamed/`);
  expect(current?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-static", "");
  await expect(page.locator(".mbk-previous")).toHaveCount(0);
  await expectCleanHydration(page, errors, "renamed/index.html");
  const catalogue = readCatalogue(
    await (
      await page.request.get(`${historical.url}/mokly-viewer/catalogue.json`)
    ).json(),
  );
  const moved = catalogue.pages.find((entry) => entry.path === "renamed")!;
  expect(moved.previousPath).toBe("renamed-old");
  expect(moved.changes).toEqual({
    status: "ready",
    kind: "unmodified",
    included: true,
  });
  expect(catalogue.removedEntries.map(({ entry }) => entry.path)).toEqual([
    "removed",
  ]);
  expect(
    (await page.request.get(`${historical.url}/view/renamed-old/`)).status(),
  ).toBe(404);
});

async function functionCalls(session: CDPSession, name: string) {
  const coverage = (await session.send("Profiler.takePreciseCoverage")) as {
    result: Array<{
      functions: Array<{
        functionName: string;
        ranges: Array<{ count: number }>;
      }>;
    }>;
  };
  return coverage.result
    .flatMap((script) => script.functions)
    .filter((fn) => fn.functionName === name)
    .reduce((total, fn) => total + (fn.ranges[0]?.count ?? 0), 0);
}
