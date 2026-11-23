/**
 * The compare modes of the right panel's Changes tab and their keys, on the
 * copied comparison output. An eligible screen shows the five tiles in the
 * order of their keys, and while Changes is the selected tab each key selects
 * its mode. A key typed in a text field, or pressed while Inspect is the
 * selected tab, selects nothing. An added screen offers Current alone, so its
 * key 2 selects nothing.
 */

import { expect, type Page } from "@playwright/test";

import { changesPanel } from "./changes_tab_ui.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonFrames, type modeButton } from "./comparison_ui.js";
import { passRenderingUpdates } from "./page_settling.js";
import { openPanelTab } from "./panel_actions.js";

test.use({ viewport: { width: 1600, height: 1000 } });

/** Open an entry's Changes tab. */
async function openChanges(page: Page, entryPath: string): Promise<void> {
  await page.goto(`/view/${entryPath}/`);
  await openPanelTab(page, "Changes");
}

/** Expect `name` to be the one tile of the shown mode. */
async function expectShownMode(
  page: Page,
  name: Parameters<typeof modeButton>[1],
): Promise<void> {
  await expect(
    page
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("button", { pressed: true }),
  ).toHaveAccessibleName(name);
}

test("an eligible screen shows the five tiles in key order, and each key selects its mode while Changes is selected", async ({
  page,
}) => {
  await openChanges(page, comparisonPaths.changed);
  await expect(page.getByRole("group", { name: "Comparison mode" }))
    .toMatchAriaSnapshot(`
    - group "Comparison mode":
      - /children: equal
      - button "Current" [pressed]
      - button "Side by side"
      - button "Overlay"
      - button "Difference"
      - button "Swipe"
  `);
  for (const [key, name] of [
    ["2", "Side by side"],
    ["3", "Overlay"],
    ["4", "Difference"],
    ["5", "Swipe"],
  ] as const) {
    await page.keyboard.press(key);
    await expectShownMode(page, name);
  }
  // Key 1 takes the canvas back to the current frames.
  await expect(comparisonFrames(page)).not.toHaveCount(0);
  await page.keyboard.press("1");
  await expectShownMode(page, "Current");
  await expect(comparisonFrames(page)).toHaveCount(0);
});

test("a key typed in the search field types its digit and selects no mode", async ({
  page,
}) => {
  await openChanges(page, comparisonPaths.changed);
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await search.click();
  await page.keyboard.press("3");
  // The field and the tiles render the same key press together.
  await expect(search).toHaveValue("3");
  await expectShownMode(page, "Current");
  await expect(comparisonFrames(page)).toHaveCount(0);
});

test("a key pressed while Inspect is selected selects no mode", async ({
  page,
}) => {
  await openChanges(page, comparisonPaths.changed);
  await page.keyboard.press("2");
  await expectShownMode(page, "Side by side");
  await openPanelTab(page, "Inspect");
  await page.keyboard.press("3");
  await passRenderingUpdates(page);
  await openPanelTab(page, "Changes");
  await expectShownMode(page, "Side by side");
});

test("an added screen offers Current alone, and its key 2 selects nothing", async ({
  page,
}) => {
  await openChanges(page, comparisonPaths.added);
  const tiles = page.getByRole("group", { name: "Comparison mode" });
  await expect(tiles).toMatchAriaSnapshot(`
    - group "Comparison mode":
      - /children: equal
      - button "Current" [pressed]
  `);
  await page.keyboard.press("2");
  await passRenderingUpdates(page);
  await expect(tiles).toMatchAriaSnapshot(`
    - group "Comparison mode":
      - /children: equal
      - button "Current" [pressed]
  `);
  // A mode other than Current would add Scroll together and load panes.
  await expect(
    changesPanel(page).getByRole("switch", { name: "Scroll together" }),
  ).toHaveCount(0);
  await expect(comparisonFrames(page)).toHaveCount(0);
});
