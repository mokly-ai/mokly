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
    localStorage.removeItem("mokly:nav-disclosure:v3");
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
    .toMatchObject({ "folder:pages:fixture/screens/states": true });

  await page.reload();
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
});

test("a watched folder rename resets its subtree without changing unrelated preferences", async ({
  page,
}) => {
  const watched = await startWatchedServe(
    reparentedEntrySource("screens", { sharedChildTitle: "States" }),
  );
  try {
    await page.goto(`${watched.url}/`);
    const oldChild = page.locator(
      '[data-nav-folder="folder:fixture/screens/states"]',
    );
    const oldParent = page.locator(
      '[data-nav-folder="folder:fixture/screens"]',
    );
    const unrelated = page.locator(
      '[data-nav-folder="folder:fixture/archive"]',
    );
    await expect(oldChild).not.toHaveAttribute("open", "");
    await expect(unrelated).not.toHaveAttribute("open", "");
    await toggleDisclosure(oldParent);
    await toggleDisclosure(oldChild);
    await toggleDisclosure(unrelated);
    await expect(oldChild).toHaveAttribute("open", "");
    await expect(unrelated).toHaveAttribute("open", "");
    await expect
      .poll(() => readDisclosureStorage(page))
      .toMatchObject({
        "folder:pages:fixture/screens/states": true,
        "folder:pages:fixture/archive": true,
      });

    await fs.promises.writeFile(
      watched.fixture.entryPath,
      reparentedEntrySource("screens", {
        screensTitle: "Panels",
        sharedChildTitle: "States",
      }),
    );
    const renamedChild = page.locator(
      '[data-nav-folder="folder:fixture/screens/states"]',
    );
    await expect(
      page.locator('[data-nav-folder="folder:fixture/screens"]'),
    ).toHaveAttribute("open", "", { timeout: 45_000 });
    await expect(
      oldParent.locator(":scope > summary .mbk-nav-label"),
    ).toHaveText("Panels", { timeout: 45_000 });
    await expect(renamedChild).toHaveAttribute("open", "");
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-react-shell",
      "",
    );
    await expect(renamedChild).toHaveAttribute("open", "");
    await expect(oldChild).toHaveCount(1);
    await expect(unrelated).toHaveAttribute("open", "");
    const stored = await readDisclosureStorage(page);
    expect(stored).toMatchObject({
      "folder:pages:fixture/screens/states": true,
      "folder:pages:fixture/archive": true,
    });
    expect(stored).toHaveProperty("folder:pages:fixture/screens/states", true);
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
        "folder:pages:fixture/screens": false,
        "folder:pages:fixture/screens/states": false,
      });
  } finally {
    await watched.stop();
  }
});
