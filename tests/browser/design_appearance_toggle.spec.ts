import { expect, test, type Page } from "@playwright/test";

import { chooseScheme, chooseViewport } from "./workspace_actions.js";

/** The catalogue background each appearance mockup paints for its scheme. */
const BACKGROUNDS = {
  dark: "rgb(20, 24, 22)",
  light: "rgb(244, 244, 241)",
} as const;

const routes = [
  ["design/browse/appearance/overview.html", "a selected screen"],
  ["design/browse/appearance/workspaces/side-by-side.html", "a comparison"],
  ["design/browse/appearance/states/light-only.html", "a light-only screen"],
] as const;

async function artboard(
  page: Page,
  viewport: "mobile" | "desktop",
): Promise<{ appearance: string | null; background: string }> {
  return await page
    .frameLocator(`.mbk-frame-${viewport} iframe`)
    .locator("[data-mbk-appearance] .mbk-shell")
    .evaluate((node) => ({
      appearance:
        node
          .closest("[data-mbk-appearance]")
          ?.getAttribute("data-mbk-appearance") ?? null,
      background: getComputedStyle(node).backgroundColor,
    }));
}

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
  for (const [route, description] of routes) {
    test(`${viewport}: the preview toggle switches ${description} between the mockup's schemes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(`/view/${route}`);
      await chooseViewport(page, viewport);
      const row = page.locator(`a[data-nav-row][data-route="${route}"]`);
      await expect(row).toHaveAttribute("aria-current", "page");

      const wrap = page.locator(`.mbk-frame-${viewport}`);
      await expect(wrap).not.toHaveAttribute("data-color-scheme-fallback", "");
      await expect(
        wrap.locator("> .mbk-frame-label .mbk-frame-scheme-note"),
      ).toHaveCount(0);

      for (const scheme of ["dark", "light", "dark"] as const) {
        await chooseScheme(page, scheme);
        await expect
          .poll(() => frameSource(page, viewport))
          .toMatch(scheme === "dark" ? /\.dark\.html$/ : /(?<!dark)\.html$/);
        await expect
          .poll(() => artboard(page, viewport))
          .toEqual({
            appearance: scheme,
            background: BACKGROUNDS[scheme],
          });
      }

      await expect(row).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveURL(new RegExp(route.replace(/\./gu, "\\.")));
    });
  }

  test(`${viewport}: a light-only inner screen keeps light frames and names its fallback under Dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/appearance/states/light-only.html");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    for (const scheme of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, scheme);
      await expect
        .poll(async () => (await artboard(page, viewport)).background)
        .toBe(BACKGROUNDS[scheme]);
      await expect(frame.locator(".mbk-screen-dark")).toHaveCount(0);
      if (scheme === "dark")
        await expect(
          frame.locator(".mbk-frame-scheme-note").first(),
        ).toContainText(/light only/iu);
      else await expect(frame.locator(".mbk-frame-scheme-note")).toHaveCount(0);
    }
  });

  test(`${viewport}: an appearance artboard draws one scheme control and previews that follow it`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/appearance/overview.html");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    for (const scheme of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, scheme);
      await expect
        .poll(async () => (await artboard(page, viewport)).appearance)
        .toBe(scheme);
      const selector = frame.locator(".mbk-appearance");
      await expect(selector).toHaveCount(1);
      await expect(selector).toHaveAttribute("data-appearance-value", scheme);
      await expect(frame.locator(".ce-theme-control")).toHaveCount(0);
      await expect(frame.locator(".ce-theme-toggle")).toHaveCount(0);
      await expect
        .poll(() => frame.locator(".mbk-screen-dark").count())
        .toBe(scheme === "dark" ? 2 : 0);
    }
  });
}
