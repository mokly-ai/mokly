import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

import { chooseViewport } from "./workspace_actions.js";

async function tabTo(page: Page, link: Locator): Promise<void> {
  for (let step = 0; step < 35; step += 1) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error("Design link was not reachable with Tab");
}

function visibleShotLink(frame: FrameLocator, name: string): Locator {
  return frame
    .locator(".mbk-shot-link:visible")
    .filter({ hasText: name })
    .first();
}

async function expectFrameRoute(
  page: Page,
  viewport: "mobile" | "desktop",
  entryPath: string,
): Promise<void> {
  await expect(page.locator(`.mbk-frame-${viewport} iframe`)).toHaveAttribute(
    "src",
    `/static/${entryPath}/index.${viewport}.html`,
  );
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport} design navigation updates Browse history, selection, and retains the outer viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/views/home/");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".mbk-empty-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await expectFrameRoute(page, viewport, "design/browse/views/screen");
    const details = visibleShotLink(frame, "Open the details screen");
    await frame.locator(".mbk-brand").focus();
    await tabTo(page, details);
    await expect(details).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/details-screen\/$/,
    );
    await expectFrameRoute(
      page,
      viewport,
      "design/browse/views/details-screen",
    );
    const row = page.locator(
      'a[data-nav-row][data-route="design/browse/views/details-screen/index.html"]',
    );
    await expect(row).toHaveAttribute("aria-current", "page");
    await expect(row).toBeVisible();
    await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
      "data-viewport",
      viewport,
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await expectFrameRoute(page, viewport, "design/browse/views/screen");
    await expect(details).toBeVisible();
    await page.goForward();
    await expect(row).toHaveAttribute("aria-current", "page");
    await expectFrameRoute(
      page,
      viewport,
      "design/browse/views/details-screen",
    );
    await visibleShotLink(frame, "Return to welcome").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await expect(frame.locator("script")).toHaveCount(1);
    await expect(frame.locator("script")).toHaveAttribute(
      "src",
      "/__mokly/client/inspector.js",
    );
    const iframe = page.locator(`.mbk-frame-${viewport} iframe`);
    expect((await iframe.getAttribute("sandbox"))?.split(/\s+/)).not.toContain(
      "allow-scripts",
    );
    await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
      "data-viewport",
      viewport,
    );
  });

  test(`${viewport} comparison, tags, and flow links use canonical designs`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/views/screen/");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await visibleShotLink(frame, "Open the details screen").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/details-screen\/$/,
    );
    await visibleShotLink(frame, "Return to welcome").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/screen\/tag-picker\/$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "forms", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/screen\/tag-forms\/$/,
    );
    await expect(frame.locator(".mbk-search-value")).toHaveText("tag:forms");
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/states\/tag-filter\/$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "forms", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await page.goto("/view/design/changes/diff-controls/current/");
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Side by side" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/changes\/outcomes\/changed\/$/,
    );
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Overlay" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/changes\/diff-controls\/overlay\/$/,
    );
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Current" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/changes\/diff-controls\/current\/$/,
    );
    await page.goto("/view/design/browse/views/use-case/");
    await frame.locator(".flow-step-link").nth(1).click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/details-screen\/$/,
    );
  });
}

test("narrow design menu and drawer close return through canonical home", async ({
  page,
}) => {
  await page.goto("/view/design/browse/views/home/");
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await frame.getByRole("link", { name: "Open catalogue navigation" }).click();
  await expect(page).toHaveURL(/\/view\/design\/browse\/states\/navigation\/$/);
  await frame.getByRole("link", { name: "Close catalogue navigation" }).click();
  await expect(page).toHaveURL(/\/view\/design\/browse\/views\/home\/$/);
  await frame.getByRole("link", { name: "Open catalogue navigation" }).click();
  await expect(page).toHaveURL(/\/view\/design\/browse\/states\/navigation\/$/);
  await frame
    .locator(".mbk-nav-row")
    .filter({ hasText: /^Details$/ })
    .click();
  await expect(page).toHaveURL(
    /\/view\/design\/browse\/views\/details-screen\/$/,
  );
});
