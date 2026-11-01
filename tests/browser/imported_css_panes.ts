/**
 * Comparison panes of the JavaScript screen whose CSS Module changes between
 * the two commits, as `addImportedCssSources` writes it. Any host that serves
 * its comparison snapshots can check them.
 */

import fs from "node:fs/promises";

import { expect, type Page } from "@playwright/test";

import {
  importedCssColors,
  importedCssImage,
} from "../helpers/imported_css_sources.js";

const comparisonModes = {
  Overlay: "overlay",
  Difference: "difference",
  "Side by side": "side",
} as const;

/** The byte length of the PNG that the CSS Module loads through `url()`. */
export async function importedImageSize(): Promise<number> {
  return (await fs.stat(importedCssImage)).size;
}

/** Each side's pane renders its own module colour and loads the image bytes. */
export async function expectStyledPanes(
  page: Page,
  imageSize: number,
  mode: keyof typeof comparisonModes,
): Promise<void> {
  const panes = page.locator(
    `[data-diff-viewport="desktop"] [data-compare-mode="${comparisonModes[mode]}"]`,
  );
  for (const [side, color] of [
    ["before", importedCssColors.Before],
    ["after", importedCssColors.After],
  ] as const) {
    const frame = panes.locator(
      `[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/${side}/"]`,
    );
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
