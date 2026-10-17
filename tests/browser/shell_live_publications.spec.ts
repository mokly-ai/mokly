/**
 * Live publications in Serve, under the shell delivery contract: the shell
 * adopts each published state in place, replaces only the frames whose
 * `documentKey` changed, keeps keyboard focus, and loads the page again only
 * for another deployment.
 */

import { expect, type Page } from "@playwright/test";

import { checkBrowserErrors } from "./browser_errors.js";
import { test } from "./browser_test.js";
import {
  closeServe,
  frameReport,
  liveIndex,
  replaceFile,
  screenFile,
  serveLiveCatalogue,
  tagFrames,
} from "./live_shell_fixture.js";

checkBrowserErrors();

/** A property that only the first page load of this document carries. */
const mounted = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { specMounted?: boolean }).specMounted,
  );

test("a publication updates the shell in place without a page load", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    await page.goto(`${server.url}/view/home/`);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await page.evaluate(() => {
      (window as unknown as { specMounted?: boolean }).specMounted = true;
    });
    let loads = 0;
    page.on("load", () => {
      loads += 1;
    });
    const before = await liveIndex(server.url);
    await replaceFile(
      server.root,
      "specs/other.screen.html",
      screenFile("Other renamed", "<h1>Other v1</h1>"),
    );
    await expect(
      page.locator('a[data-entry-id="other"][data-nav-row]'),
    ).toContainText("Other renamed");
    expect((await liveIndex(server.url)).revision).toBeGreaterThan(
      before.revision,
    );
    expect(await mounted(page)).toBe(true);
    expect(loads).toBe(0);
  } finally {
    await closeServe(page, server);
  }
});

test("a publication replaces only the frames whose document changed", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    await page.goto(`${server.url}/view/tour/`);
    await expect
      .poll(async () => (await frameReport(page)).map((frame) => frame.text))
      .toEqual([
        expect.stringContaining("Home v1"),
        expect.stringContaining("Other v1"),
      ]);
    expect(await tagFrames(page)).toBe(2);
    await replaceFile(
      server.root,
      "specs/other.screen.html",
      screenFile("Other", "<h1>Other v2</h1>"),
    );
    await expect
      .poll(async () => (await frameReport(page))[1]?.text)
      .toContain("Other v2");
    const [home, other] = await frameReport(page);
    expect(home).toMatchObject({ tag: "0", title: "Home — desktop" });
    expect(home?.text).toContain("Home v1");
    expect(other).toMatchObject({ tag: null, title: "Other — desktop" });
  } finally {
    await closeServe(page, server);
  }
});

test("keyboard focus stays on its element while a publication is adopted", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    await page.goto(`${server.url}/view/home/`);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    const homeLink = page.locator('a[data-entry-id="home"][data-nav-row]');
    await homeLink.focus();
    await replaceFile(
      server.root,
      "specs/other.screen.html",
      screenFile("Other renamed", "<h1>Other v1</h1>"),
    );
    await expect(
      page.locator('a[data-entry-id="other"][data-nav-row]'),
    ).toContainText("Other renamed");
    await expect(homeLink).toBeFocused();
    const copy = page.getByRole("button", { name: "Copy path home" });
    await copy.focus();
    await replaceFile(
      server.root,
      "specs/home.screen.html",
      screenFile("Home", "<h1>Home v2</h1>"),
    );
    await expect
      .poll(async () => (await frameReport(page))[0]?.text)
      .toContain("Home v2");
    await expect(copy).toBeFocused();
  } finally {
    await closeServe(page, server);
  }
});

test("a message from another deployment loads the current URL again", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    let replaced = false;
    await page.route("**/mokly-viewer/events", async (route) => {
      if (replaced) return route.continue();
      replaced = true;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `id: 1\ndata: ${"f".repeat(64)}\n\n`,
      });
    });
    let loads = 0;
    page.on("load", () => {
      loads += 1;
    });
    await page.goto(`${server.url}/view/other/`);
    await expect.poll(() => loads).toBe(2);
    await expect(page).toHaveURL(`${server.url}/view/other/`);
    await expect(page.locator("#mb-main h2")).toHaveText("Other");
  } finally {
    await closeServe(page, server);
  }
});
