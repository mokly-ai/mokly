/**
 * A small copy with a JavaScript screen that imports a CSS Module whose rule
 * loads a PNG through `url()`. Every comparison mode keeps each side's own
 * module style and its copied image bytes in the static output.
 */

import fs from "node:fs/promises";

import { expect, type Page } from "@playwright/test";

import {
  addImportedCssSources,
  importedCssColors,
  importedCssImage,
  importedCssPaths,
} from "../helpers/imported_css_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";

const test = additionsCopyTest("browser-imported-css", addImportedCssSources);

/** Each side's pane renders its own colour and loads the image bytes. */
async function expectStyledPanes(page: Page, imageSize: number) {
  for (const [side, color] of [
    ["before", importedCssColors.Before],
    ["after", importedCssColors.After],
  ] as const) {
    const frame = page
      .locator(
        `[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/${side}/"]`,
      )
      .first();
    await expect(frame).toHaveAttribute("srcdoc", /\S/u);
    const button = frame
      .contentFrame()
      .getByRole("button", { name: "Sign in" });
    await expect(button).toHaveCSS("color", color);
    const bytes = await button.evaluate(async (element) => {
      const value = getComputedStyle(element).backgroundImage;
      const image = /^url\(["']?(.*?)["']?\)$/u.exec(value)?.[1];
      if (!image) return -1;
      const response = await fetch(image);
      return response.ok ? (await response.arrayBuffer()).byteLength : -1;
    });
    expect(bytes).toBe(imageSize);
  }
}

test("static export comparison panes retain CSS Modules and url assets", async ({
  page,
}) => {
  const imageSize = (await fs.stat(importedCssImage)).size;
  await page.goto(`/view/${importedCssPaths.screen}/`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expectStyledPanes(page, imageSize);
  for (const mode of ["Difference", "Side by side"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expectStyledPanes(page, imageSize);
  }
});
