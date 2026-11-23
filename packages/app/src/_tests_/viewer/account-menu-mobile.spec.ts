import { expect, open, test } from "../harness";

import { publishedProject, publishedViewerReady } from "./support";

test("on a phone More opens as a sheet that owns the page, with 44px rows, and Close returns to More", async ({
  page,
}) => {
  const made = await publishedProject(page, "more-sheet");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const address = page.url();
  const historyLength = await page.evaluate(() => window.history.length);
  const more = page.getByTestId("viewer-more");
  await more.click();

  const sheet = page.getByTestId("viewer-panel-more");
  await expect(sheet).toBeVisible();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  // The sheet takes the page's one landmark and heading, over the inert viewer.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("More");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  expect((await sheet.boundingBox())?.width).toBe(page.viewportSize()?.width);
  await expect(
    sheet.getByRole("menu", { name: "More" }).getByRole("menuitem"),
  ).toHaveText([/ \/ /, "History", "Share"]);
  await expect(
    sheet.getByRole("menu", { name: "Account" }).getByRole("menuitem"),
  ).toHaveText(["Settings", "Docs", "Changelog", "Sign out"]);
  await expect(sheet.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  for (const row of await sheet.getByRole("menuitem").all())
    expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  // A menu is not an overlay of the address and adds no history entry.
  expect(page.url()).toBe(address);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

  await page.getByTestId("close-more").click();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("aria-expanded", "false");
});
