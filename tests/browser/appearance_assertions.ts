import { expect, type Page } from "@playwright/test";

import { canvasFrame, expectFrameSource } from "./workspace_actions.js";

export const control = ".mbk-topbar [data-mokly-appearance-control]";

export const select = "[data-mokly-appearance-select]";

export const mobileFrame = ".mbk-frame-mobile iframe";

export const desktopFrame = ".mbk-frame-desktop iframe";

export const screen = "/view/example/screens/welcome/";

/**
 * The appearance the document actually settled on: the document root's mark,
 * the shell root's preview scheme, and the control's value.
 */
export async function appearance(page: Page): Promise<{
  scheme: string | null;
  theme: string | null;
  value: string;
}> {
  return await page.evaluate(() => ({
    scheme:
      document
        .querySelector(".mbk[data-mokly-shell]")
        ?.getAttribute("data-mokly-color-scheme") ?? null,
    theme: document.documentElement.getAttribute("data-mokly-theme"),
    value:
      document.querySelector<HTMLSelectElement>(
        "[data-mokly-appearance-select]",
      )?.value ?? "",
  }));
}

/**
 * Expect a screen's canvas frames, which keep their own scheme whatever the
 * appearance: each viewport's Light frame shows the light document, and its
 * Dark frame the dark one, or a light-only screen has no Dark frame.
 */
export async function expectCanvasFrames(
  page: Page,
  entry: string,
  dark: boolean,
): Promise<void> {
  for (const viewport of ["mobile", "desktop"] as const) {
    await expectFrameSource(
      page.locator(canvasFrame(viewport)),
      new RegExp(`${entry}/index\\.${viewport}\\.html$`, "u"),
    );
    if (dark)
      await expectFrameSource(
        page.locator(canvasFrame(viewport, "dark")),
        new RegExp(`${entry}/index\\.${viewport}\\.dark\\.html$`, "u"),
      );
    else
      await expect(page.locator(canvasFrame(viewport, "dark"))).toHaveCount(0);
  }
}

export async function store(page: Page, value: string): Promise<void> {
  await page.addInitScript((theme) => {
    localStorage.setItem("mokly:theme", theme as string);
  }, value);
}
