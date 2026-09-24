import fs from "node:fs";

import { expect, test, type Locator } from "@playwright/test";

import { reparentedEntrySource } from "../helpers/fixture.js";

import { startWatchedServe, type WatchedServe } from "./watched_serve.js";

let server: WatchedServe;

async function toggleDisclosure(disclosure: Locator): Promise<void> {
  const toggled = disclosure.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        element.addEventListener(
          "toggle",
          () => requestAnimationFrame(() => resolve()),
          { once: true },
        );
      }),
  );
  await disclosure.locator(":scope > summary").click();
  await toggled;
}

test.beforeAll(async () => {
  server = await startWatchedServe(reparentedEntrySource("screens"), {
    extraConfig: `colorSchemes: ["light", "dark"],`,
  });
});

test.afterAll(async () => {
  if (server) await server.stop();
});

test("watched reparenting moves navigation and crumbs together", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Screens");
  const screens = page.locator(
    'details[data-nav-folder="folder:Fixture/Screens"]',
  );
  const archive = page.locator(
    'details[data-nav-folder="folder:Fixture/Archive"]',
  );
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");

  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("archive", { firstTitle: "Home Reloaded" }),
  );

  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Archive", {
    timeout: 45_000,
  });
  await expect(
    archive.locator('a[data-route="screens/home.html"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(archive).toHaveAttribute("open", "");
  await expect(
    screens.locator('a[data-route="screens/home.html"]'),
  ).toHaveCount(0);
  await expect(screens).not.toHaveAttribute("open", "");
});

test("duplicate folder titles under different parents retain independent disclosure", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("archive", {
      firstTitle: "Home Reloaded",
      sharedChildTitle: "Same title",
    }),
  );
  const screens = page.locator(
    'details[data-nav-folder="folder:Fixture/Screens/Same title"]',
  );
  const archive = page.locator(
    'details[data-nav-folder="folder:Fixture/Archive/Same title"]',
  );
  await expect(screens.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
    { timeout: 45_000 },
  );
  await expect(archive.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
  );

  await page.addInitScript(() => {
    localStorage.removeItem("mokly:nav-disclosure:v2");
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  const screensParent = page.locator(
    'details[data-nav-folder="folder:Fixture/Screens"]',
  );
  await expect(screensParent).not.toHaveAttribute("open", "");
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await toggleDisclosure(screensParent);
  await expect(screensParent).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("mokly:nav-disclosure:v2")),
    )
    .toContain("folder:pages:Fixture/Screens/Same title");

  await page.reload();
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
});
