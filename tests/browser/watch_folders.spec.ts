import fs from "node:fs";

import { expect, test, type Locator } from "@playwright/test";

import { reparentedEntrySource } from "../helpers/fixture.js";

import { readDisclosureStorage } from "./disclosure_storage.js";
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

test("watched path moves retain the missing old URL until the new row is selected", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/screens/home/`);
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Screens");
  const screens = page.locator(
    'details[data-nav-folder="folder:fixture/screens"]',
  );
  const archive = page.locator(
    'details[data-nav-folder="folder:fixture/archive"]',
  );
  await toggleDisclosure(screens);
  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("archive", { firstTitle: "Home Reloaded" }),
  );
  const moved = archive.locator(
    'a[data-route="fixture/archive/home/index.html"]',
  );
  await expect(moved).toContainText("Home Reloaded", { timeout: 45_000 });
  await expect(page.locator("#mb-main")).toContainText("Item not found");
  await expect(page).toHaveURL(/\/view\/fixture\/screens\/home\/$/);
  if ((await archive.getAttribute("open")) === null)
    await toggleDisclosure(archive);
  await moved.click();
  await expect(page).toHaveURL(/\/view\/fixture\/archive\/home\/$/);
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Archive");
  await expect(moved).toHaveAttribute("aria-current", "page");
  await expect(screens).not.toHaveAttribute("open", "");
});

test("duplicate folder titles under different parents retain independent disclosure", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/fixture/archive/states/home/`);
  await fs.promises.writeFile(
    server.fixture.entryPath,
    reparentedEntrySource("archive", {
      firstTitle: "Home Reloaded",
      sharedChildTitle: "Same title",
    }),
  );
  const screens = page.locator(
    'details[data-nav-folder="folder:fixture/screens/states"]',
  );
  const archive = page.locator(
    'details[data-nav-folder="folder:fixture/archive/states"]',
  );
  await expect(screens.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
    { timeout: 45_000 },
  );
  await expect(archive.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
  );

  await page.evaluate(() => {
    localStorage.removeItem("mokly:nav-disclosure:v4");
  });
  await page.goto(`${server.url}/view/fixture/archive/states/home/`);
  const screensParent = page.locator(
    'details[data-nav-folder="folder:fixture/screens"]',
  );
  await expect(screensParent).not.toHaveAttribute("open", "");
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await toggleDisclosure(screensParent);
  await expect(screensParent).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({ "folder:specs:fixture/screens/states": true });

  await page.reload();
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
});

test("a watched folder title change keeps its own, descendant, and unrelated preferences", async ({
  page,
}) => {
  const watched = await startWatchedServe(
    reparentedEntrySource("screens", { sharedChildTitle: "States" }),
  );
  try {
    await page.goto(`${watched.url}/`);
    const child = page.locator(
      '[data-nav-folder="folder:fixture/screens/states"]',
    );
    const parent = page.locator('[data-nav-folder="folder:fixture/screens"]');
    const unrelated = page.locator(
      '[data-nav-folder="folder:fixture/archive"]',
    );
    await expect(child).not.toHaveAttribute("open", "");
    await expect(unrelated).not.toHaveAttribute("open", "");
    await toggleDisclosure(parent);
    await toggleDisclosure(child);
    await toggleDisclosure(unrelated);
    await expect(child).toHaveAttribute("open", "");
    await expect(unrelated).toHaveAttribute("open", "");
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({
        "folder:specs:fixture/screens": true,
        "folder:specs:fixture/screens/states": true,
        "folder:specs:fixture/archive": true,
      });

    await fs.promises.writeFile(
      watched.fixture.entryPath,
      reparentedEntrySource("screens", {
        screensTitle: "Panels",
        sharedChildTitle: "States",
      }),
    );
    await expect(parent.locator(":scope > summary .mbk-nav-label")).toHaveText(
      "Panels",
      { timeout: 45_000 },
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-react-shell",
      "",
    );
    await expect(parent).toHaveAttribute("open", "");
    await expect(child).toHaveAttribute("open", "");
    await expect(unrelated).toHaveAttribute("open", "");
    expect(await readDisclosureStorage(page)).toMatchObject({
      "folder:specs:fixture/screens": true,
      "folder:specs:fixture/screens/states": true,
      "folder:specs:fixture/archive": true,
    });
  } finally {
    await watched.stop();
  }
});

test("a watched folder path change drops its old keys from saved storage", async ({
  page,
}) => {
  const watched = await startWatchedServe(
    reparentedEntrySource("screens", { sharedChildTitle: "States" }),
  );
  try {
    await page.goto(`${watched.url}/`);
    const parent = page.locator('[data-nav-folder="folder:fixture/screens"]');
    const child = page.locator(
      '[data-nav-folder="folder:fixture/screens/states"]',
    );
    const unrelated = page.locator(
      '[data-nav-folder="folder:fixture/archive"]',
    );
    await toggleDisclosure(parent);
    await toggleDisclosure(child);
    await toggleDisclosure(unrelated);
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({
        "folder:specs:fixture/screens": true,
        "folder:specs:fixture/screens/states": true,
        "folder:specs:fixture/archive": true,
      });

    await fs.promises.writeFile(
      watched.fixture.entryPath,
      reparentedEntrySource("screens", {
        screensSlug: "panels",
        sharedChildTitle: "States",
      }),
    );
    const moved = page.locator('[data-nav-folder="folder:fixture/panels"]');
    await expect(moved).toHaveCount(1, { timeout: 45_000 });
    await expect(parent).toHaveCount(0);
    await expect(moved).not.toHaveAttribute("open", "");
    await expect(unrelated).toHaveAttribute("open", "");
    await expect
      .poll(async () => {
        const stored = await readDisclosureStorage(page);
        return [
          "folder:specs:fixture/screens",
          "folder:specs:fixture/screens/states",
          "folder:specs:fixture/panels",
          "folder:specs:fixture/panels/states",
          "folder:specs:fixture/archive",
        ].map((key) => stored[key]);
      })
      .toEqual([undefined, undefined, false, false, true]);
  } finally {
    await watched.stop();
  }
});

test("filtered watched folder title changes preserve keys and restore disclosure after clearing", async ({
  page,
}) => {
  const watched = await startWatchedServe(
    reparentedEntrySource("screens", { sharedChildTitle: "States" }),
  );
  try {
    await page.goto(`${watched.url}/`);
    await page.fill("[data-mokly-search]", "Details");
    await expect(
      page.locator('[data-nav-folder="folder:fixture/screens/states"]'),
    ).toHaveAttribute("open", "");

    await fs.promises.writeFile(
      watched.fixture.entryPath,
      reparentedEntrySource("screens", {
        screensTitle: "Panels",
        sharedChildTitle: "States",
      }),
    );
    const parent = page.locator('[data-nav-folder="folder:fixture/screens"]');
    const child = page.locator(
      '[data-nav-folder="folder:fixture/screens/states"]',
    );
    await expect(parent.locator(":scope > summary .mbk-nav-label")).toHaveText(
      "Panels",
      { timeout: 45_000 },
    );
    await expect(parent).toHaveAttribute("open", "", { timeout: 45_000 });
    await expect(child).toHaveAttribute("open", "");
    await expect(
      child.locator(
        'a[data-nav-row][data-route="fixture/screens/states/details/index.html"]',
      ),
    ).toBeVisible();

    await page.fill("[data-mokly-search]", "");
    await expect(parent).not.toHaveAttribute("open", "");
    await expect(child).not.toHaveAttribute("open", "");
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({
        "folder:specs:fixture/screens": false,
        "folder:specs:fixture/screens/states": false,
      });
  } finally {
    await watched.stop();
  }
});
