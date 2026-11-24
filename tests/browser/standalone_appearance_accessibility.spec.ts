import { expect } from "@playwright/test";

import {
  appearance,
  control,
  expectCanvasFrames,
  screen,
  select,
} from "./appearance_assertions.js";
import { shellRoot } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { missingResourceNotice } from "./document_error_allowance.js";
import {
  canvasFrame,
  expectFrameSource,
  NARROW_WINDOW,
} from "./workspace_actions.js";

test("the appearance keeps working when storage refuses", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new Error("blocked origin");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => ({ getItem: blocked, setItem: blocked, removeItem: blocked }),
    });
  });
  await page.goto(screen);
  await page.locator(select).selectOption("dark");
  // The choice holds for this document even though nothing could be saved.
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await expectCanvasFrames(page, "example/screens/welcome", true);
});

test("Appearance can be set from the keyboard alone", async ({ page }) => {
  await page.goto(screen);
  await page.locator(select).focus();
  await expect(page.locator(select)).toBeFocused();
  await page.locator(select).press("ArrowDown");
  await page.locator(select).press("ArrowDown");
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
});

test("an unavailable route still offers Appearance", async ({
  page,
  baseURL,
  allowBrowserError,
}) => {
  allowBrowserError(
    missingResourceNotice(new URL("/view/missing/", baseURL).href),
  );
  await page.goto("/view/missing/");
  await expect(page.locator(control)).toBeVisible();
  await page.locator(select).selectOption("dark");
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
});

test("on the canvas, a component's Light and Dark samples keep their schemes under the one Appearance control", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  const own = '[data-workspace-variant="example/components/action"]';
  const samples = [
    [page.locator(`${canvasFrame("desktop")}${own}`), ""],
    [page.locator(`${canvasFrame("desktop", "dark")}${own}`), "\\.dark"],
  ] as const;
  // No separate preview control: the Appearance dresses the interface.
  await expect(page.getByRole("button", { name: "Dark preview" })).toHaveCount(
    0,
  );
  for (const choice of ["dark", "light"] as const) {
    await page.locator(select).selectOption(choice);
    await expect(page.locator(shellRoot)).toHaveAttribute(
      "data-mokly-color-scheme",
      choice,
    );
    for (const [sample, dark] of samples)
      await expectFrameSource(
        sample,
        new RegExp(`example/components/action/index\\.desktop${dark}\\.html$`),
      );
  }
});

test("below the layout breakpoint, a saved variant's one frame follows the one Appearance control", async ({
  page,
}) => {
  await page.setViewportSize(NARROW_WINDOW);
  // A saved variant picks its frame of the set, in the preview scheme.
  await page.goto("/view/example/components/action/default/");
  const sample = page.locator(
    '.mbk-canvas-cell:not([hidden]) [data-workspace-frame="desktop"]',
  );
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.html$/,
  );
  // No separate preview control: the frame follows the interface appearance.
  await expect(page.getByRole("button", { name: "Dark preview" })).toHaveCount(
    0,
  );

  await page.locator(select).selectOption("dark");
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.dark\.html$/,
  );

  await page.locator(select).selectOption("light");
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.html$/,
  );
});
