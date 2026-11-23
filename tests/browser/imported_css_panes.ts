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

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import type { DiffMode } from "./comparison_ui.js";

const comparisonModes = {
  Overlay: "overlay",
  Difference: "difference",
  "Side by side": "side",
} as const satisfies Partial<Record<DiffMode, string>>;

/** The byte length of the PNG that the CSS Module loads through `url()`. */
export async function importedImageSize(): Promise<number> {
  return (await fs.stat(importedCssImage)).size;
}

/**
 * Each side's pane of the Desktop · Light frame, which every mode compares,
 * renders its own module colour and loads the image bytes.
 */
export async function expectStyledPanes(
  page: Page,
  imageSize: number,
  mode: keyof typeof comparisonModes,
): Promise<void> {
  const section = comparisonSection(page, "desktop");
  // A stack names its mode once; Side by side names it on each version.
  await expect(
    section.locator(`[data-compare-mode="${comparisonModes[mode]}"]`),
  ).toHaveCount(mode === "Side by side" ? 2 : 1);
  for (const [side, color] of [
    ["before", importedCssColors.Before],
    ["after", importedCssColors.After],
  ] as const) {
    const frame = paneFrame(section, side);
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      new RegExp(`/snapshots/${side}/`, "u"),
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
