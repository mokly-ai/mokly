/**
 * A light-only saved variant under a Dark selection on the copied comparison
 * output, under the comparison modes contract: the variant's status, its
 * comparison band, and its marks follow the Light views that it displays,
 * and none of its frames loads a dark document.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { NARROW_WINDOW, revealInPanel } from "./workspace_actions.js";

/** Open the variant under Dark, whose status and marks follow Light. */
async function openUnderDark(page: Page): Promise<void> {
  await page.goto(`/view/${comparisonPaths.lightOnlyVariant}/?scheme=dark`);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Lamp");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  // The band stands in the right panel, a sheet of the compact layout.
  await revealInPanel(page, page.locator(".mbk-diff-toolbar"));
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  // The Dark selection stays.
  await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
    "dark",
  );
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
}

test("a light-only saved variant uses its displayed scheme for status and marks", async ({
  page,
}) => {
  await openUnderDark(page);
  // On the canvas the variant's row shows its Light frame alone.
  const row = page.locator(
    `iframe[data-workspace-variant="${comparisonPaths.lightOnlyVariant}"]`,
  );
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-workspace-color-scheme", "light");
  await expect(row).toHaveAttribute("src", /\.html$/u);
  await expect(row).not.toHaveAttribute("src", /\.dark\.html$/u);
});

test("below the layout breakpoint, a light-only saved variant shows its Light frame under Dark", async ({
  page,
}) => {
  await page.setViewportSize(NARROW_WINDOW);
  await openUnderDark(page);
  // The compact layout's one frame is the variant's Light frame, which its
  // label and the frame picker name.
  const shown = page.locator(
    ".mbk-canvas-cell:not([hidden]) iframe[data-workspace-frame]",
  );
  await expect(shown).toHaveCount(1);
  await expect(shown).toHaveAttribute(
    "data-workspace-variant",
    comparisonPaths.lightOnlyVariant,
  );
  await expect(shown).toHaveAttribute("data-workspace-color-scheme", "light");
  await expect(shown).toHaveAttribute("src", /\.html$/u);
  await expect(shown).not.toHaveAttribute("src", /\.dark\.html$/u);
  await expect(page.getByRole("combobox", { name: "Frame" })).toHaveValue(
    `${comparisonPaths.lightOnlyVariant}:light`,
  );
});
