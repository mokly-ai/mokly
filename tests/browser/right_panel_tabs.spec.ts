/**
 * The right panel's tabs under the inspector design: Inspect always, and
 * Changes where the entry has it. The selected tab survives in-shell
 * navigation to an entry that has it, Inspect returns once the shell knows
 * that an entry has none and at a full page load, and in Changes a click on
 * a frame selects nothing.
 */

import { expect, type Page } from "@playwright/test";

import {
  closeReadOnlyCatalogue,
  test,
} from "./serve_comparison_read_only_test.js";
import {
  canvasFrame,
  openPanelSheet,
  openPanelTab,
} from "./workspace_actions.js";

test.afterAll(closeReadOnlyCatalogue);

/** The labels of the panel's tabs and the label of the selected one. */
async function expectTabs(
  page: Page,
  tabs: readonly string[],
  selected: string,
): Promise<void> {
  const strip = page.getByRole("tablist", { name: "Panel" });
  await expect(strip.getByRole("tab")).toHaveText([...tabs]);
  await expect(strip.getByRole("tab", { selected: true })).toHaveText(selected);
}

/** Open an entry through its catalogue row, inside the shell. */
async function openRow(page: Page, path: string): Promise<void> {
  await page.locator(`a[data-nav-row][data-entry-id="${path}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/view/${path}/$`, "u"));
}

test("the selected tab survives in-shell navigation to an entry that has it, and Inspect returns where an entry has none", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/view/${changes.paths.changed}/`);
  await expectTabs(page, ["Inspect", "Changes"], "Inspect");
  await openPanelTab(page, "Changes");
  await expectTabs(page, ["Inspect", "Changes"], "Changes");
  // Changes holds the comparison band and then the comparison details.
  const tab = page.getByRole("tabpanel", { name: "Changes" });
  await expect(
    tab.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
  await expect(tab.locator("[data-workspace-evidence]")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Inspect" })).toBeHidden();

  // An unchanged screen has Inspect alone, and the shell then forgets Changes.
  await openRow(page, changes.paths.unchanged);
  await expectTabs(page, ["Inspect"], "Inspect");
  await openRow(page, changes.paths.changed);
  await expectTabs(page, ["Inspect", "Changes"], "Inspect");

  // A full page load starts on Inspect.
  await openPanelTab(page, "Changes");
  await page.reload();
  await expectTabs(page, ["Inspect", "Changes"], "Inspect");
});

test("in Changes a click on a frame selects nothing, and the canvas draws no selection", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/view/${changes.paths.changed}/`);
  const frame = canvasFrame("mobile");
  await expect(page.locator(frame)).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  const card = page.frameLocator(frame).getByText("Card content");
  const drawn = page.getByRole("img", { name: / selected, / });
  // In Inspect the click selects the Card.
  await card.click();
  await expect(drawn).toHaveCount(1);
  await openPanelTab(page, "Changes");
  await expect(drawn).toHaveCount(0);
  await openPanelTab(page, "Inspect");
  await page.keyboard.press("Escape");
  await expect(drawn).toHaveCount(0);
  await openPanelTab(page, "Changes");
  await card.click();
  await openPanelTab(page, "Inspect");
  await expect(drawn).toHaveCount(0);
  await expect(
    page.locator('[data-inspect-section="selection"]'),
  ).toContainText("Click an element on a frame to see its props.");
});

test("the compact layout's dock names the panel's current tab", async ({
  page,
  changes,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/view/${changes.paths.changed}/`);
  const dock = page.getByRole("group", { name: "Canvas controls" });
  await expect(dock.getByRole("button", { name: "Inspect" })).toBeVisible();
  await openPanelSheet(page);
  await openPanelTab(page, "Changes");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Changes" })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Inspect" })).toHaveCount(0);
});
