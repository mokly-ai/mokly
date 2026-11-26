import { expect, type Page } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
} from "./workspace_actions.js";

const SCHEMES = ["light", "dark"] as const;

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
// This case wires the shell's frames to the mockup documents, and it reads
// what only a browser computes: the painted root of each layout and the
// accessible Dark toggle of the light-only design. The document facts of
// every Canvas view are checked by `appearanceViolations` in
// `tests/design_catalogue.test.ts`.
test("each canvas frame keeps a selected screen in its own mockup scheme, paints each layout, and names the light-only fallback", async ({
  page,
}) => {
  const viewport = "desktop";
  const entryPath = "design/canvas/overview";
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

  // The compact Mobile artboards paint their own root in each scheme.
  await chooseViewport(page, "mobile");
  for (const scheme of SCHEMES)
    await expect
      .poll(() => artboard(page, "mobile", scheme))
      .toEqual({
        appearance: scheme,
        background: await canvasColor(scheme, "--cv-background"),
      });

  // A light-only inner screen: each frame's Frames filter disables Dark and
  // names the fallback to a reader.
  await page.goto("/view/design/canvas/inspect/unchanged/");
  for (const shown of ["desktop", "mobile"] as const) {
    await chooseViewport(page, shown);
    for (const scheme of SCHEMES) {
      const dark = page
        .frameLocator(canvasFrame(shown, scheme))
        .getByRole("group", { name: "Frames", exact: true })
        .getByRole("checkbox", { name: /^Dark/u });
      await expect(dark).toBeDisabled();
      await expect(dark).toHaveAccessibleName(/light only/iu);
    }
  }
});
