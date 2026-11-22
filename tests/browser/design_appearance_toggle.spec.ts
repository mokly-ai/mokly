import { expect, type Page } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";

import { test } from "./browser_test.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const paths = [
  ["design/canvas/overview", "a selected screen"],
  ["design/canvas/changes/side-by-side", "a comparison"],
  ["design/canvas/inspect/unchanged", "a light-only screen"],
] as const;

/** The scheme that the shown artboard's Canvas root draws, and its canvas. */
async function artboard(
  page: Page,
  viewport: "mobile" | "desktop",
): Promise<{ appearance: string | null; background: string }> {
  return await page
    .frameLocator(`.mbk-frame-${viewport} iframe`)
    .locator(".cv-root[data-mbk-appearance]")
    .evaluate((node) => ({
      appearance: node.getAttribute("data-mbk-appearance"),
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
  for (const [entryPath, description] of paths) {
    test(`${viewport}: the preview toggle switches ${description} between the mockup's schemes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(`/view/${entryPath}/`);
      await chooseViewport(page, viewport);
      const row = page.locator(
        `a[data-nav-row][data-route="${entryPath}/index.html"]`,
      );
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
            background: await canvasColor(scheme, "--cv-background"),
          });
      }

      await expect(row).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveURL(`/view/${entryPath}/`);
    });
  }

  test(`${viewport}: a light-only inner screen keeps light frames and its Frames filter names the fallback`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/canvas/inspect/unchanged/");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    const dark = frame
      .getByRole("group", { name: "Frames", exact: true })
      .getByRole("checkbox", { name: /^Dark/u });
    for (const scheme of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, scheme);
      const background = await canvasColor(scheme, "--cv-background");
      await expect
        .poll(async () => (await artboard(page, viewport)).background)
        .toBe(background);
      await expect(
        frame.locator('[data-preview-color-scheme="dark"]'),
      ).toHaveCount(0);
      await expect(dark).toBeDisabled();
      await expect(dark).toHaveAccessibleName(/light only/iu);
    }
  });

  test(`${viewport}: an appearance artboard draws one scheme control that follows the scheme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/canvas/overview/");
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
    }
  });
}
