import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const design = (route: string, viewport: string) =>
  pathToFileURL(
    path.join(
      repositoryRoot,
      `examples/basic/generated/design/${route}.${viewport}.html`,
    ),
  ).href;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: portable design links work without Browse enhancement`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport:
        viewport === "mobile"
          ? { width: 390, height: 1000 }
          : { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(design("browse/views/home", viewport));
    await page.locator(".mbk-empty-link").click();
    await expect(page).toHaveURL(design("browse/views/screen", viewport));
    await page.locator(".mbk-shot-link:visible").first().click();
    await expect(page).toHaveURL(
      design("browse/views/details-screen", viewport),
    );
    await page.locator(".mbk-shot-link:visible").first().click();
    await page.locator(".mbk-search-tag").click();
    await page
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "onboarding", exact: true })
      .click();
    await expect(page).toHaveURL(
      design("browse/states/tags/onboarding", viewport),
    );
    await page.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      design("browse/states/tags/onboarding-picker", viewport),
    );
    await page.getByRole("link", { name: "Close tag picker" }).click();
    await expect(page).toHaveURL(
      design("browse/states/tags/onboarding", viewport),
    );
    await page.goto(design("browse/views/use-case", viewport));
    await page.locator(".flow-step-link").nth(1).click();
    await expect(page).toHaveURL(
      design("browse/views/details-screen", viewport),
    );
    await context.close();
  });

  test(`${viewport}: link adaptation preserves row hit areas, colors, and toolbar dimensions`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 1000 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(design("browse/views/screen", viewport));
    await page.goto(design("review/controls/current", viewport));
    const toolbar = page.getByRole("group", { name: "Comparison mode" });
    const current = toolbar.getByText("Current", { exact: true });
    const side = toolbar.getByRole("link", { name: "Side by side" });
    const currentBounds = await current.boundingBox();
    const sideBounds = await side.boundingBox();
    expect(currentBounds?.height).toBe(sideBounds?.height);
    expect((sideBounds?.width ?? 0) > 70).toBe(true);
    await page.goto(design("browse/views/screen", viewport));
    if (viewport === "desktop") {
      const row = page.locator(".mbk-nav-row.active");
      await expect(row).toHaveCSS("display", "flex");
      await expect(row).toHaveCSS("color", "rgb(255, 255, 255)");
      const bounds = await row.boundingBox();
      expect(bounds?.width).toBeGreaterThan(180);
      await row.click({ position: { x: (bounds?.width ?? 200) - 5, y: 12 } });
      await expect(page).toHaveURL(design("browse/views/screen", viewport));
    }
    await page.goto(design("browse/views/screen", `${viewport}.dark`));
    const link = page.locator(".mbk-shot-link:visible").first();
    await link.focus();
    await expect(link).toHaveCSS("outline-style", "solid");
    await expect(link).toHaveCSS("color", "rgb(127, 174, 149)");
    await page.screenshot({
      path: `.context/design-dark-focus-${viewport}.png`,
      fullPage: true,
    });
    for (const route of ["review/outcomes/removed", "review/impact/empty"]) {
      await page.goto(design(route, viewport));
      await expect(page.locator(".mbk-cmp-toolbar a")).toHaveCount(0);
      for (const control of await page
        .locator(".mbk-idchip, .mbk-search-tag")
        .all())
        await expect(control).not.toHaveAttribute("tabindex");
    }
  });
}
