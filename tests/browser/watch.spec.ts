import fs from "node:fs";

import { expect, test, type Locator } from "@playwright/test";

import { reparentedEntrySource } from "../helpers/fixture.js";

import { startWatchedServe, type WatchedServe } from "./watched_serve.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";
import { expectFrameSource } from "./workspace_actions.js";

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

test("watched serve rebuilds and reloads after an authored change", async ({
  page,
}) => {
  let releaseFirstEventRequest = (): void => undefined;
  const firstEventRequestBlocked = new Promise<void>((resolve) => {
    releaseFirstEventRequest = resolve;
  });
  let blockFirstEventRequest = true;
  await page.route(`${server.url}/__mokly/events`, async (route) => {
    if (blockFirstEventRequest) {
      blockFirstEventRequest = false;
      await firstEventRequestBlocked;
    }
    await route.continue();
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  const screens = page.locator(
    'details[data-nav-folder="folder:Fixture/Screens"]',
  );
  const archive = page.locator(
    'details[data-nav-folder="folder:Fixture/Archive"]',
  );
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).not.toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "html");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /screens\/home\.mobile\.dark\.html$/,
  );
  const details = page.locator("[data-workspace-inspector]");
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.setViewportSize({ height: 900, width: 420 });
  await page.click("[data-mokly-menu]");
  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("screens", {
      body: '<a href="mock:details">Details</a><p data-watch-version="2">Reloaded</p>',
    }),
  );
  await expect
    .poll(async () => {
      try {
        return (
          await (
            await fetch(`${server.url}/static/screens/home.mobile.html`)
          ).text()
        ).includes('data-watch-version="2"');
      } catch {
        return false;
      }
    })
    .toBe(true);
  releaseFirstEventRequest();
  await expect(
    page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator('[data-watch-version="2"]'),
  ).toHaveText("Reloaded", { timeout: 45_000 });
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("html");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /screens\/home\.mobile\.dark\.html$/,
  );
  // The reload recovers the appearance itself, not just the frames it picks.
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
  await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
    "dark",
  );
  await expect(details).not.toHaveAttribute("data-open", "true");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-drawer",
    "open",
  );
  await page.fill("[data-mokly-search]", "");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).not.toHaveAttribute("open", "");
});

test("watched reload reopens collapsed active route ancestry", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  const screens = page.locator(
    'details[data-nav-folder="folder:Fixture/Screens"]',
  );
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "html");
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");

  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("screens", {
      body: '<a href="mock:details">Details</a><p data-watch-version="3">Active route</p>',
    }),
  );

  await expect(
    page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator('[data-watch-version="3"]'),
  ).toHaveText("Active route", { timeout: 45_000 });
  await expect(page.locator("[data-mokly-search]")).toHaveValue("html");
  await expect(screens).toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "");
  await expect(screens).toHaveAttribute("open", "");
});

test("watched serve shuts down cleanly", async () => {
  expect(await server.stop()).toBe(0);
  await expect(async () => {
    await fetch(`${server.url}/`);
  }).rejects.toThrow();
});
