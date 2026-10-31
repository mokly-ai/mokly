import { expect } from "@playwright/test";

import { hasMarker, markPage, shellRoot } from "./browse_assertions.js";
import {
  documentMark,
  folder,
  markDocument,
  screenKeys,
  test,
  toggleFolder,
  watchedScreen,
} from "./watch_fixture.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

test("watched authored edits replace the changed document and retain Browse state", async ({
  page,
  watched,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${watched.url}/mokly-viewer/events`, async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(`${watched.url}/view/fixture/screens/home/`);
    await markPage(page);
    const screens = folder(page, "screens");
    const archive = folder(page, "archive");
    await expect(screens).toHaveAttribute("open", "");
    await toggleFolder(screens);
    await page.locator("[data-mokly-search]").fill("home");
    await expect(screens).toHaveAttribute("open", "");
    await expect(archive).toHaveAttribute("open", "");
    await chooseViewport(page, "mobile");
    await chooseScheme(page, "dark");
    const frame = page.locator(".mbk-frame-mobile iframe");
    await expectFrameSource(frame, /home\/index\.mobile\.dark\.html$/u);
    await expect(frame.contentFrame().locator("h1")).toHaveText(
      "Original home",
    );
    await markDocument(frame);
    const details = page.locator("[data-workspace-inspector]");
    await expect(details).not.toHaveAttribute("data-open", "true");
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await expect(details).toHaveAttribute("data-open", "true");
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await expect(details).not.toHaveAttribute("data-open", "true");
    await page.setViewportSize({ width: 420, height: 900 });
    await page.locator("[data-mokly-menu]").click();
    const first = await watched.index();
    const keys = screenKeys(first, "screens/home");
    const { after } = await watched.change(
      () =>
        watched.write(
          "specs/fixture/screens/home.screen.html",
          watchedScreen("Home", '<h1 data-watch-version="2">Updated home</h1>'),
        ),
      (index) =>
        screenKeys(index, "screens/home")?.every(
          (key, offset) => key !== keys?.[offset],
        ) === true,
    );
    expect(screenKeys(after, "screens/details")).toEqual(
      screenKeys(first, "screens/details"),
    );
    release();
    await expect(
      frame.contentFrame().locator('[data-watch-version="2"]'),
    ).toHaveText("Updated home");
    await expectFrameSource(frame, /home\/index\.mobile\.dark\.html$/u);
    expect(await documentMark(frame)).toBeUndefined();
    expect(await hasMarker(page)).toBe(true);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect(page.locator("[data-mokly-search]")).toHaveValue("home");
    await expect(screens).toHaveAttribute("open", "");
    await expect(archive).toHaveAttribute("open", "");
    await expect(page.locator(".mbk-frame-desktop")).toBeHidden();
    await expect(page.locator(shellRoot)).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-theme",
      "dark",
    );
    await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
      "dark",
    );
    await expect(details).not.toHaveAttribute("data-open", "true");
    await expect(page.locator(".mbk[data-mokly-shell]")).toHaveAttribute(
      "data-drawer",
      "open",
    );
    await page.locator("[data-mokly-search]").fill("");
    await expect(screens).not.toHaveAttribute("open", "");
    await expect(archive).not.toHaveAttribute("open", "");
  } finally {
    release();
  }
});

test("watched publications keep collapsed active ancestry until a route change reveals it", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/screens/home/`);
  await chooseViewport(page, "mobile");
  await markPage(page);
  const screens = folder(page, "screens");
  await toggleFolder(screens);
  await page.locator("[data-mokly-search]").fill("home");
  await expect(screens).toHaveAttribute("open", "");
  await toggleFolder(screens);
  const keys = screenKeys(await watched.index(), "screens/home");
  await watched.change(
    () =>
      watched.write(
        "specs/fixture/screens/home.screen.html",
        watchedScreen(
          "Home",
          '<h1>Edited home</h1><a href="mock:./details">Details</a>',
        ),
      ),
    (index) => screenKeys(index, "screens/home")?.[0] !== keys?.[0],
  );
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await expect(frame.locator("h1")).toHaveText("Edited home");
  expect(await hasMarker(page)).toBe(true);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("home");
  await expect(screens).not.toHaveAttribute("open", "");
  await page.locator("[data-mokly-search]").fill("");
  await expect(screens).not.toHaveAttribute("open", "");
  await frame.getByRole("link", { name: "Details", exact: true }).click();
  await expect(page).toHaveURL(/\/view\/fixture\/screens\/details\/$/u);
  await expect(screens).toHaveAttribute("open", "");
  expect(await hasMarker(page)).toBe(true);
});
