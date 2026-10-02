import { expect, test, type Page } from "@playwright/test";

import { chooseScheme, chooseViewport } from "./workspace_actions.js";

/** The document the frame actually shows, including history-replacing swaps. */
async function frameSource(
  page: Page,
  viewport: "mobile" | "desktop",
): Promise<string> {
  return await page
    .locator(`.mbk-frame-${viewport} iframe`)
    .evaluate(
      (frame: HTMLIFrameElement) =>
        frame.contentWindow?.location.href ?? frame.src,
    );
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: doc designs navigate through their own details, drawer and links`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/screens/design-doc-view.html");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/screens\/design-doc-details\.html$/);
    await expect(frame.locator(".mbk-details-body")).toContainText(
      "docs/welcome-specification.md",
    );
    await frame.getByRole("link", { name: "notes.md", exact: true }).click();
    await expect(page).toHaveURL(/\/view\/screens\/design-doc-view\.html$/);
    if (viewport === "mobile") {
      await frame
        .getByRole("link", { name: "Open catalogue navigation" })
        .click();
      await expect(page).toHaveURL(
        /\/view\/screens\/design-doc-navigation\.html$/,
      );
      await frame
        .getByRole("link", { name: "Close catalogue navigation" })
        .click();
      await expect(page).toHaveURL(/\/view\/screens\/design-doc-view\.html$/);
    } else {
      await frame.locator(".mbk-nav-filter a").click();
      await expect(page).toHaveURL(
        /\/view\/screens\/design-doc-removed\.html$/,
      );
      await expect(frame.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await page.goBack();
      await expect(page).toHaveURL(/\/view\/screens\/design-doc-view\.html$/);
    }
    await frame
      .getByRole("link", { name: "Open the Welcome screen", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-screen\.html$/,
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/screens\/design-doc-view\.html$/);
  });

  test(`${viewport}: a doc follows the Appearance control while a removed doc stays light`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    for (const [route, dark] of [
      ["design-doc-view", 1],
      ["design-doc-removed", 0],
    ] as const) {
      await page.goto(`/view/screens/${route}.html`);
      await chooseViewport(page, viewport);
      const row = page.locator(
        `a[data-nav-row][data-route="screens/${route}.html"]`,
      );
      await expect(row).toHaveAttribute("aria-current", "page");
      const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
      for (const scheme of ["dark", "light", "dark"] as const) {
        await chooseScheme(page, scheme);
        await expect
          .poll(() => frameSource(page, viewport))
          .toMatch(scheme === "dark" ? /\.dark\.html$/ : /(?<!dark)\.html$/);
        await expect(
          frame.locator("[data-mbk-appearance]").first(),
        ).toHaveAttribute("data-mbk-appearance", scheme);
        await expect(frame.locator(".mbk-doc-view")).toHaveCount(1);
        await expect(
          frame.locator(".mbk-doc-view.mbk-screen-dark"),
        ).toHaveCount(scheme === "dark" ? dark : 0);
        await expect(frame.locator(".mbk-previous-scheme-note")).toHaveCount(
          scheme === "dark" && dark === 0 ? 1 : 0,
        );
      }
      await expect(row).toHaveAttribute("aria-current", "page");
    }
  });
}
