/**
 * The change stepper of the right panel's Changes tab, on the Changes tab
 * catalogue, whose Changes filter lists five entries: Added screen, Details
 * screen, Tour and Retired screen in Specs, then Badge in Components. The
 * stepper reads an entry's place and the count; its steps open the entry
 * before and after it on its Changes tab and keep the reader's frames; the
 * ends of the list are disabled; and an eligible entry that the filter does
 * not list has Changes without a stepper.
 */

import { expect, type Page } from "@playwright/test";

import { changesTabPaths, test } from "./changes_tab_test.js";
import {
  changeCount,
  changeStep,
  comparedRail,
  frameFigure,
} from "./changes_tab_ui.js";
import { comparisonIndex, modeButton, snapshotOf } from "./comparison_ui.js";
import { openPanelTab } from "./panel_actions.js";
import { setFrames } from "./workspace_actions.js";

test.use({ viewport: { width: 1600, height: 1000 } });

/**
 * Expect the canvas to show Desktop · Dark alone, the frame that the reader
 * chose with the Frames filter.
 */
async function expectDesktopDarkAlone(page: Page): Promise<void> {
  await expect(frameFigure(page, "Desktop · Dark")).toBeVisible();
  for (const label of ["Desktop · Light", "Mobile · Light", "Mobile · Dark"])
    await expect(frameFigure(page, label)).toBeHidden();
}

/** Expect the right panel to show its Changes tab. */
async function expectChangesSelected(page: Page): Promise<void> {
  await expect(
    page.getByRole("tab", { name: "Changes", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
}

test("Previous change and Next change open the listed change before and after on its Changes tab, with the reader's frames", async ({
  page,
}) => {
  await page.goto(`/view/${changesTabPaths.details}/`);
  await setFrames(page, {
    desktop: true,
    dark: true,
    mobile: false,
    light: false,
  });
  await openPanelTab(page, "Changes");
  await expect(changeCount(page)).toHaveText("Change 2 of 5");

  await changeStep(page, "Previous change").click();
  await expect(page).toHaveURL(`/view/${changesTabPaths.added}/`);
  await expectChangesSelected(page);
  await expect(changeCount(page)).toHaveText("Change 1 of 5");
  await expectDesktopDarkAlone(page);
  // The first change has no change before it.
  await expect(changeStep(page, "Previous change")).toBeDisabled();

  await changeStep(page, "Next change").click();
  await expect(page).toHaveURL(`/view/${changesTabPaths.details}/`);
  await expectChangesSelected(page);
  await expect(changeCount(page)).toHaveText("Change 2 of 5");
  await expectDesktopDarkAlone(page);
});

test("the last change has no next change, and Previous change opens the removed screen before it", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    changesTabPaths.retired,
  );
  await page.goto(`/view/${changesTabPaths.badge}/`);
  await openPanelTab(page, "Changes");
  await expect(changeCount(page)).toHaveText("Change 5 of 5");
  await expect(changeStep(page, "Next change")).toBeDisabled();

  await changeStep(page, "Previous change").click();
  await expect(page).toHaveURL(
    `/view/${changesTabPaths.retired}/?snapshot=${snapshot}`,
  );
  await expectChangesSelected(page);
  await expect(changeCount(page)).toHaveText("Change 4 of 5");
});

test("an eligible entry that Changes does not list has the Changes tab without a stepper", async ({
  page,
}) => {
  // Consumer screen stays Unmodified, and Badge, which it uses, changed.
  await page.goto(`/view/${changesTabPaths.consumer}/`);
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Side by side")).toBeVisible();
  await expect(comparedRail(page)).toBeVisible();
  await expect(changeCount(page)).toHaveCount(0);
  await expect(changeStep(page, "Previous change")).toHaveCount(0);
  await expect(changeStep(page, "Next change")).toHaveCount(0);
});
