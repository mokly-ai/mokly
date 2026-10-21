/**
 * An Affected screens link's comparison intent belongs to the one navigation
 * that carried it. The consumer opens in Side by side; after the reader
 * selects Current, a watched update keeps Current and requests no comparison.
 */

import { expect } from "@playwright/test";

import { modeButton, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  awaitSelectedComparison,
  selectedRequests,
} from "./serve_comparison_ui.js";

/** A source outside Card and Consumer, so the update leaves both unchanged. */
const STABLE_SOURCE = "specs/screens/stable.screen.html";

test("a watched update keeps Current after an Affected link opened Side by side", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests = selectedRequests(page);
  await page.goto(`/view/${changes.paths.component}/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const link = page
    .locator('[data-usage-section="affected"]')
    .getByRole("link", { name: "Consumer screen", exact: true });
  await expect(link).toHaveAttribute("href", /[?&]comparison=side(?:&|$)/u);
  await awaitSelectedComparison(page, () => link.click());
  await expect(page).toHaveURL(/[?&]comparison=side(?:&|$)/u);
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests).toHaveLength(1);

  await modeButton(page, "Current").click();
  await expect(modeButton(page, "Current")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await changes.edit(
    STABLE_SOURCE,
    "---\ntitle: Stable renamed\ncolorSchemes: [light]\n---\n<h1>Stable screen</h1>",
    (index) =>
      index.screens.find((entry) => entry.path === changes.paths.unchanged)
        ?.title === "Stable renamed",
  );
  await expect(navRow(page, changes.paths.unchanged)).toContainText(
    "Stable renamed",
  );
  // The address still holds the intent; the update must not apply it again.
  await expect(page).toHaveURL(/[?&]comparison=side(?:&|$)/u);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await expect(modeButton(page, "Current")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-diff-stage]")).toBeHidden();
  expect(requests).toHaveLength(1);
});
