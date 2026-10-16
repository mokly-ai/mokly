import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

async function expectFragments(page: Page, fragment: string) {
  const frames = page.locator(
    ".mbk-frame-mobile iframe, .mbk-frame-desktop iframe",
  );
  await expect(frames).toHaveCount(2);
  for (const frame of await frames.all())
    await expectFrameSource(frame, new RegExp(`#${fragment}$`));
}
async function expectTop(page: Page) {
  for (const frame of await page
    .locator(".mbk-frame-mobile iframe, .mbk-frame-desktop iframe")
    .all())
    await expect
      .poll(() =>
        frame.evaluate(
          (element: HTMLIFrameElement) => element.contentWindow!.scrollY,
        ),
      )
      .toBe(0);
}
test("direct screen fragments update current and swap sources", async ({
  page,
}) => {
  await page.goto("/view/example/screens/details/?fragment=details");
  await expectFragments(page, "details");
  await chooseScheme(page, "dark");
  await expectFragments(page, "details");
  await page.goto("/view/example/screens/details/?fragment=absent-anchor");
  await expectFragments(page, "absent-anchor");
  await expectTop(page);
  await chooseScheme(page, "dark");
  await expectFragments(page, "absent-anchor");
  await expectTop(page);
});
test("invalid and duplicate direct fragments leave every source unchanged", async ({
  page,
}) => {
  for (const query of [
    "fragment=%23details",
    "fragment=details&fragment=other",
  ]) {
    await page.goto(`/view/example/screens/details/?${query}`);
    const frames = page.locator(
      ".mbk-frame-mobile iframe, .mbk-frame-desktop iframe",
    );
    await expect(frames).toHaveCount(2);
    for (const frame of await frames.all())
      await expectFrameSource(
        frame,
        /\/details\/index\.(mobile|desktop)(?:\.dark)?\.html$/,
      );
    await chooseScheme(page, "dark");
    for (const frame of await frames.all())
      await expectFrameSource(
        frame,
        /\/details\/index\.(mobile|desktop)\.dark\.html$/,
      );
  }
});
test("use-case fragments apply to the first step only", async ({ page }) => {
  await page.goto("/view/example/tour/?fragment=welcome");
  const frames = page.locator(".mbk-flow-screen iframe");
  await expect(frames).toHaveCount(2);
  await expectFrameSource(frames.nth(0), /#welcome$/);
  await expectFrameSource(frames.nth(1), /\.html$/);
  await chooseScheme(page, "dark");
  await expectFrameSource(frames.nth(0), /\.dark\.html#welcome$/);
  await expectFrameSource(frames.nth(1), /\.dark\.html$/);
});
test("a logical link retains its fragment through navigation and swaps", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await page
    .frameLocator(".mbk-frame-mobile iframe")
    .getByRole("link", { name: "Open the details screen", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/view\/example\/screens\/details\/\?fragment=details$/,
  );
  await expectFragments(page, "details");
  await chooseScheme(page, "dark");
  await expectFragments(page, "details");
});
