import { expect, type Page } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
} from "./workspace_actions.js";

const SCHEMES = ["light", "dark"] as const;

const paths = [
  ["design/canvas/overview", "a selected screen"],
  ["design/canvas/changes/side-by-side", "a comparison"],
  ["design/canvas/inspect/unchanged", "a light-only screen"],
] as const;

type Viewport = "mobile" | "desktop";
type Scheme = (typeof SCHEMES)[number];

/** The scheme that the frame's Canvas root draws, and its canvas. */
async function artboard(
  page: Page,
  viewport: Viewport,
  scheme: Scheme,
): Promise<{ appearance: string | null; background: string }> {
  return await page
    .frameLocator(canvasFrame(viewport, scheme))
    .locator(".cv-root[data-mbk-appearance]")
    .evaluate((node) => ({
      appearance: node.getAttribute("data-mbk-appearance"),
      background: getComputedStyle(node).backgroundColor,
    }));
}

/** The document the frame actually shows, including history-replacing swaps. */
async function frameSource(
  page: Page,
  viewport: Viewport,
  scheme: Scheme,
): Promise<string> {
  return await page
    .locator(canvasFrame(viewport, scheme))
    .evaluate(
      (frame: HTMLIFrameElement) =>
        frame.contentWindow?.location.href ?? frame.src,
    );
}

// From 900px wide, the canvas shows each mockup's Light frame beside its
// Dark frame, and each frame keeps its own scheme whatever the Appearance.
for (const viewport of ["mobile", "desktop"] as const) {
  for (const [entryPath, description] of paths) {
    test(`${viewport}: each canvas frame keeps ${description} in its own mockup scheme through the preview toggle`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(`/view/${entryPath}/`);
      await chooseViewport(page, viewport);
      const row = page.locator(
        `a[data-nav-row][data-route="${entryPath}/index.html"]`,
      );
      await expect(row).toHaveAttribute("aria-current", "page");
      // The mockup has dark views, so no frame falls back to Light.
      for (const scheme of SCHEMES)
        await expect(page.locator(canvasFrame(viewport, scheme))).toBeVisible();

      for (const choice of ["dark", "light", "dark"] as const) {
        await chooseScheme(page, choice);
        for (const scheme of SCHEMES) {
          await expect
            .poll(() => frameSource(page, viewport, scheme))
            .toMatch(scheme === "dark" ? /\.dark\.html$/ : /(?<!dark)\.html$/);
          await expect
            .poll(() => artboard(page, viewport, scheme))
            .toEqual({
              appearance: scheme,
              background: await canvasColor(scheme, "--cv-background"),
            });
        }
      }

      // The scheme choices keep the address, which names the chosen viewport.
      await expect(row).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveURL(`/view/${entryPath}/?viewport=${viewport}`);
    });
  }

  test(`${viewport}: a light-only inner screen keeps light frames and each canvas frame's Frames filter names the fallback`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/canvas/inspect/unchanged/");
    await chooseViewport(page, viewport);
    for (const choice of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, choice);
      for (const scheme of SCHEMES) {
        const frame = page.frameLocator(canvasFrame(viewport, scheme));
        const dark = frame
          .getByRole("group", { name: "Frames", exact: true })
          .getByRole("checkbox", { name: /^Dark/u });
        const background = await canvasColor(scheme, "--cv-background");
        await expect
          .poll(async () => (await artboard(page, viewport, scheme)).background)
          .toBe(background);
        await expect(
          frame.locator('[data-preview-color-scheme="dark"]'),
        ).toHaveCount(0);
        await expect(dark).toBeDisabled();
        await expect(dark).toHaveAccessibleName(/light only/iu);
      }
    }
  });

  test(`${viewport}: an appearance artboard draws one scheme control that follows its canvas frame's scheme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/canvas/overview/");
    await chooseViewport(page, viewport);
    for (const choice of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, choice);
      for (const scheme of SCHEMES) {
        const frame = page.frameLocator(canvasFrame(viewport, scheme));
        await expect
          .poll(async () => (await artboard(page, viewport, scheme)).appearance)
          .toBe(scheme);
        const selector = frame.locator(".mbk-appearance");
        await expect(selector).toHaveCount(1);
        await expect(selector).toHaveAttribute("data-appearance-value", scheme);
      }
    }
  });
}
