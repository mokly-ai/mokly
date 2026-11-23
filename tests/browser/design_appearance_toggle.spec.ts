import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
} from "./workspace_actions.js";

/** The catalogue background each appearance mockup paints for its scheme. */
const BACKGROUNDS = {
  dark: "rgb(17, 17, 19)",
  light: "rgb(241, 242, 238)",
} as const;

const SCHEMES = ["light", "dark"] as const;

const paths = [
  ["design/browse/appearance/overview", "a selected screen"],
  ["design/browse/appearance/workspaces/side-by-side", "a comparison"],
  ["design/browse/appearance/states/light-only", "a light-only screen"],
] as const;

type Viewport = "mobile" | "desktop";
type Scheme = (typeof SCHEMES)[number];

async function artboard(
  page: Page,
  viewport: Viewport,
  scheme: Scheme,
): Promise<{ appearance: string | null; background: string }> {
  return await page
    .frameLocator(canvasFrame(viewport, scheme))
    .locator("[data-mbk-appearance] .mbk[data-mokly-shell]")
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
              background: BACKGROUNDS[scheme],
            });
        }
      }

      await expect(row).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveURL(`/view/${entryPath}/`);
    });
  }

  test(`${viewport}: a light-only inner screen keeps light frames and names its fallback in the Dark frame`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/appearance/states/light-only/");
    await chooseViewport(page, viewport);
    for (const choice of ["dark", "light", "dark"] as const) {
      await chooseScheme(page, choice);
      for (const scheme of SCHEMES) {
        const frame = page.frameLocator(canvasFrame(viewport, scheme));
        await expect
          .poll(async () => (await artboard(page, viewport, scheme)).background)
          .toBe(BACKGROUNDS[scheme]);
        await expect(
          frame.locator('[data-preview-color-scheme="dark"]'),
        ).toHaveCount(0);
        if (scheme === "dark")
          await expect(
            frame.locator(".mbk-frame-scheme-note").first(),
          ).toContainText(/light only/iu);
        else
          await expect(frame.locator(".mbk-frame-scheme-note")).toHaveCount(0);
      }
    }
  });

  test(`${viewport}: an appearance artboard draws one scheme control and previews that follow its frame's scheme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/appearance/overview/");
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
        await expect(frame.locator(".ce-theme-control")).toHaveCount(0);
        await expect(frame.locator(".ce-theme-toggle")).toHaveCount(0);
        await expect
          .poll(() =>
            frame.locator('[data-preview-color-scheme="dark"]').count(),
          )
          .toBe(scheme === "dark" ? 2 : 0);
      }
    }
  });
}
