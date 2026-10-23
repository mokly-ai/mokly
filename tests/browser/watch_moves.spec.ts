import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { readDisclosureStorage } from "./disclosure_storage.js";
import {
  documentMark,
  folder,
  folderTitle,
  markDocument,
  screenKeys,
  test,
  toggleFolder,
  watchedScreen,
} from "./watch_fixture.js";
import { chooseViewport } from "./workspace_actions.js";

test("watched path moves keep the missing old URL until the new row is selected", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/screens/home/`);
  await markPage(page);
  const screens = folder(page, "screens");
  const archive = folder(page, "archive");
  await toggleFolder(screens);
  const { after } = await watched.change(
    async () => {
      await watched.write(
        "specs/fixture/screens/home.screen.html",
        watchedScreen("Moved home"),
      );
      await watched.move(
        "specs/fixture/screens/home.screen.html",
        "specs/fixture/archive/moved.screen.html",
      );
    },
    (index) =>
      !screenKeys(index, "screens/home") &&
      index.screens.some(
        (entry) =>
          entry.path === "fixture/archive/moved" &&
          entry.title === "Moved home",
      ),
  );
  expect(screenKeys(after, "screens/home")).toBeUndefined();
  const moved = archive.locator(
    'a[data-route="fixture/archive/moved/index.html"]',
  );
  await expect(moved).toContainText("Moved home");
  await expect(page.locator("#mb-main")).toContainText("Item not found");
  await expect(page).toHaveURL(/\/view\/fixture\/screens\/home\/$/u);
  expect(await hasMarker(page)).toBe(true);
  await expect(archive).not.toHaveAttribute("open", "");
  await toggleFolder(archive);
  await moved.click();
  await expect(page).toHaveURL(/\/view\/fixture\/archive\/moved\/$/u);
  await expect(page.locator("#mb-main h2")).toHaveText("Moved home");
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Archive");
  await expect(
    page
      .locator(".mbk-crumbs")
      .getByRole("button", { name: "Archive", exact: true }),
  ).toBeVisible();
  await expect(moved).toHaveAttribute("aria-current", "page");
  await expect(screens).not.toHaveAttribute("open", "");
  expect(await hasMarker(page)).toBe(true);
});

test("watched folder moves prune old disclosure keys and keep unrelated documents", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/other/`);
  await chooseViewport(page, "mobile");
  await markPage(page);
  const frame = page.locator(".mbk-frame-mobile iframe");
  await expect(frame.contentFrame().locator("h1")).toHaveText("Other");
  await markDocument(frame);
  const screens = folder(page, "screens");
  const child = folder(page, "screens/states");
  const archive = folder(page, "archive");
  await toggleFolder(screens);
  await toggleFolder(child);
  await toggleFolder(archive);
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:fixture/screens": true,
      "folder:specs:fixture/screens/states": true,
      "folder:specs:fixture/archive": true,
    });
  const { before, after } = await watched.change(
    () => watched.move("specs/fixture/screens", "specs/fixture/panels"),
    (index) =>
      folderTitle(index, "panels") === "Screens" &&
      folderTitle(index, "screens") === undefined,
  );
  expect(screenKeys(after, "other")).toEqual(screenKeys(before, "other"));
  const panels = folder(page, "panels");
  await expect(panels).toHaveCount(1);
  await expect(screens).toHaveCount(0);
  await expect(panels).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(async () => {
      const stored = await readDisclosureStorage(page);
      return [
        "screens",
        "screens/states",
        "panels",
        "panels/states",
        "archive",
      ].map((key) => stored[`folder:specs:fixture/${key}`]);
    })
    .toEqual([undefined, undefined, false, false, true]);
  expect(await documentMark(frame)).toBe("retained");
  expect(await hasMarker(page)).toBe(true);
  await watched.change(
    () =>
      watched.write("specs/fixture/panels/_folder.json", '{"title":"Panels"}'),
    (index) => folderTitle(index, "panels") === "Panels",
  );
  await expect(panels.locator(":scope > summary .mbk-nav-label")).toHaveText(
    "Panels",
  );
  expect(await documentMark(frame)).toBe("retained");
});
