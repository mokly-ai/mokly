/**
 * An Affected screens link's comparison intent belongs to the one navigation
 * that carried it. Honouring the intent opens the consumer in Side by side
 * and selects the right panel's Changes tab. After the reader selects Current
 * and returns to Inspect, a watched update applies the intent no more: it
 * keeps Current and Inspect and requests no comparison.
 */

import { expect } from "@playwright/test";

import { comparisonSection } from "./comparison_sections.js";
import {
  chooseMode,
  compareState,
  comparisonFrames,
  modeButton,
  navRow,
} from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  awaitSelectedComparison,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { openInspectFold, openPanelTab } from "./workspace_actions.js";

/** A source outside Card and Consumer, so the update leaves both unchanged. */
const STABLE_SOURCE = "specs/screens/stable.screen.html";

test("a watched update keeps Current after an Affected link opened Side by side", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests = selectedRequests(page);
  const changesTab = page.getByRole("tab", { name: "Changes", exact: true });
  const inspectTab = page.getByRole("tab", { name: "Inspect", exact: true });
  await page.goto(`/view/${changes.paths.component}/`);
  const link = (await openInspectFold(page, "usage"))
    .locator('[data-usage-section="affected"]')
    .getByRole("link", { name: "Consumer screen", exact: true });
  await expect(link).toHaveAttribute("href", /[?&]comparison=side(?:&|$)/u);
  await awaitSelectedComparison(page, () => link.click());
  await expect(page).toHaveURL(/[?&]comparison=side(?:&|$)/u);
  // Honouring the intent selects the Changes tab, and the canvas shows Side
  // by side: the pair of the first shown frame, Mobile · Light, as the link
  // names its usage's Mobile view, whose column the canvas shows.
  await expect(changesTab).toHaveAttribute("aria-selected", "true");
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    comparisonSection(page, "mobile").locator('[data-compare-mode="side"]'),
  ).toHaveCount(2);
  await expect(comparisonFrames(page)).toHaveCount(2);
  expect(requests).toHaveLength(1);

  await chooseMode(page, "Current");
  await openPanelTab(page, "Inspect");

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
  // The address still holds the intent; the update must not apply it again,
  // so Inspect stays selected and the canvas shows no comparison.
  await expect(page).toHaveURL(/[?&]comparison=side(?:&|$)/u);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(inspectTab).toHaveAttribute("aria-selected", "true");
  await expect(compareState(page)).toBeHidden();
  await expect(comparisonFrames(page)).toHaveCount(0);
  await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
  await expect(modeButton(page, "Current")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests).toHaveLength(1);
});
