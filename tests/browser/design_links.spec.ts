import { expect, test, type Locator, type Page } from "@playwright/test";

import { chooseViewport } from "./workspace_actions.js";

async function tabTo(page: Page, link: Locator): Promise<void> {
  for (let step = 0; step < 35; step += 1) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error("Design link was not reachable with Tab");
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport} design navigation updates Browse history, selection, and retains the outer viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/screens/design-browse-home.html");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".mbk-empty-link").click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    const details = frame.locator(".mbk-shot-link:visible").first();
    await frame.locator(".mbk-brand").focus();
    await tabTo(page, details);
    await expect(details).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-details-screen\.html$/,
    );
    const row = page.locator(
      'a[data-nav-row][data-route="screens/design-browse-details-screen.html"]',
    );
    await expect(row).toHaveAttribute("aria-current", "page");
    await expect(row).toBeVisible();
    await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
      "data-viewport",
      viewport,
    );
    await page.goBack();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    await page.goForward();
    await expect(row).toHaveAttribute("aria-current", "page");
    await frame.locator(".mbk-shot-link:visible").first().click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    await expect(frame.locator("script")).toHaveCount(1);
    await expect(frame.locator("script")).toHaveAttribute(
      "src",
      "/mokly-viewer/client/inspector.js",
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
    await page.goto("/view/screens/design-browse-screen.html");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".mbk-shot-link:visible").first().click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-details-screen\.html$/,
    );
    await frame.locator(".mbk-shot-link:visible").first().click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-tag-picker\.html$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "forms", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-tag-forms\.html$/,
    );
    await expect(frame.locator(".mbk-search-value")).toHaveText("tag:forms");
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-tag-filter\.html$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "forms", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    await page.goto("/view/screens/design-changes-current.html");
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Side by side" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-review-changed\.html$/,
    );
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Overlay" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-changes-overlay\.html$/,
    );
    await frame
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("link", { name: "Current" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-changes-current\.html$/,
    );
    await page.goto("/view/screens/design-browse-use-case.html");
    await frame.locator(".flow-step-link").nth(1).click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-details-screen\.html$/,
    );
  });
}

test("narrow design menu and drawer close return through canonical home", async ({
  page,
}) => {
  await page.goto("/view/screens/design-browse-home.html");
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await frame.getByRole("link", { name: "Open catalogue navigation" }).click();
  await expect(page).toHaveURL(
    /\/view\/screens\/design-browse-navigation\.html$/,
  );
  await frame.getByRole("link", { name: "Close catalogue navigation" }).click();
  await expect(page).toHaveURL(/\/view\/screens\/design-browse-home\.html$/);
  await frame.getByRole("link", { name: "Open catalogue navigation" }).click();
  await expect(page).toHaveURL(
    /\/view\/screens\/design-browse-navigation\.html$/,
  );
  await frame
    .locator(".mbk-nav-row")
    .filter({ hasText: /^Details$/ })
    .click();
  await expect(page).toHaveURL(
    /\/view\/screens\/design-browse-details-screen\.html$/,
  );
});
