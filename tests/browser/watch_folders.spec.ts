import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { readDisclosureStorage } from "./disclosure_storage.js";
import {
  folder,
  folderTitle,
  test,
  toggleFolder,
  watchedScreen,
} from "./watch_fixture.js";

test("duplicate watched folder titles keep independent disclosure keys", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/archive/states/home/`);
  await markPage(page);
  const screens = folder(page, "screens/states");
  const archive = folder(page, "archive/states");
  await watched.change(
    async () => {
      await watched.write(
        "specs/fixture/screens/states/_folder.json",
        '{"title":"Same title"}',
      );
      await watched.write(
        "specs/fixture/archive/states/_folder.json",
        '{"title":"Same title"}',
      );
    },
    (index) =>
      folderTitle(index, "screens/states") === "Same title" &&
      folderTitle(index, "archive/states") === "Same title",
  );
  for (const group of [screens, archive])
    await expect(group.locator(":scope > summary .mbk-nav-label")).toHaveText(
      "Same title",
    );
  await toggleFolder(folder(page, "screens"));
  await toggleFolder(screens);
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:fixture/screens/states": true,
      "folder:specs:fixture/archive/states": true,
    });
  await toggleFolder(screens);
  await watched.change(
    () =>
      watched.write(
        "specs/fixture/other.screen.html",
        watchedScreen("Other updated"),
      ),
    (index) =>
      index.screens.some(
        (entry) =>
          entry.path === "fixture/other" && entry.title === "Other updated",
      ),
  );
  await expect(
    page.locator('a[data-route="fixture/other/index.html"]'),
  ).toContainText("Other updated");
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:fixture/screens/states": false,
      "folder:specs:fixture/archive/states": true,
    });
  expect(await hasMarker(page)).toBe(true);
});

test("a watched folder title keeps its own, descendant, and unrelated preferences", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/other/`);
  await markPage(page);
  const parent = folder(page, "screens");
  const child = folder(page, "screens/states");
  const unrelated = folder(page, "archive");
  for (const group of [parent, child, unrelated]) await toggleFolder(group);
  const expected = {
    "folder:specs:fixture/screens": true,
    "folder:specs:fixture/screens/states": true,
    "folder:specs:fixture/archive": true,
  };
  await expect.poll(() => readDisclosureStorage(page)).toMatchObject(expected);
  await watched.change(
    () =>
      watched.write("specs/fixture/screens/_folder.json", '{"title":"Panels"}'),
    (index) => folderTitle(index, "screens") === "Panels",
  );
  await expect(parent.locator(":scope > summary .mbk-nav-label")).toHaveText(
    "Panels",
  );
  for (const group of [parent, child, unrelated])
    await expect(group).toHaveAttribute("open", "");
  expect(await readDisclosureStorage(page)).toMatchObject(expected);
  expect(await hasMarker(page)).toBe(true);
});

test("filtered watched folder titles retain keys and restore disclosure when cleared", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/other/`);
  await markPage(page);
  const parent = folder(page, "screens");
  const child = folder(page, "screens/states");
  await expect(parent).not.toHaveAttribute("open", "");
  const stored = await readDisclosureStorage(page);
  const search = page.locator("[data-mokly-search]");
  await search.fill("State details");
  await expect(parent).toHaveAttribute("open", "");
  await expect(child).toHaveAttribute("open", "");
  await watched.change(
    () =>
      watched.write("specs/fixture/screens/_folder.json", '{"title":"Panels"}'),
    (index) => folderTitle(index, "screens") === "Panels",
  );
  await expect(parent.locator(":scope > summary .mbk-nav-label")).toHaveText(
    "Panels",
  );
  await expect(search).toHaveValue("State details");
  await expect(parent).toHaveAttribute("open", "");
  await expect(child).toHaveAttribute("open", "");
  await expect(
    child.locator('a[data-route="fixture/screens/states/details/index.html"]'),
  ).toBeVisible();
  expect(await readDisclosureStorage(page)).toEqual(stored);
  await search.fill("");
  await expect(parent).not.toHaveAttribute("open", "");
  await expect(child).not.toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:fixture/screens": false,
      "folder:specs:fixture/screens/states": false,
    });
  expect(await hasMarker(page)).toBe(true);
});
