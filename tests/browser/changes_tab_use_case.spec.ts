/**
 * A use case that Changes lists, on the Changes tab catalogue: Tour, whose
 * second step, Check the details, shows the changed Details screen. The use
 * case reads Changed in its canvas section's head, in Inspect and in the
 * compact layout's entry bar. Its Changes tab holds the stepper, Compared and
 * one `Changed step:` line, with no compare modes, and the line's link opens
 * the step's screen on that screen's Changes tab.
 */

import { expect } from "@playwright/test";

import { changesTabPaths, test, tourSteps } from "./changes_tab_test.js";
import { changeCount, changesPanel, comparedRail } from "./changes_tab_ui.js";
import { openPanelTab } from "./panel_actions.js";

test.describe("in the canvas layout", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("a listed use case reads Changed, and its Changes tab holds the stepper, Compared and its changed step, without compare modes", async ({
    page,
  }) => {
    await page.goto(`/view/${changesTabPaths.tour}/`);
    // Outside its frames' documents, the section's only status text is its
    // head's.
    await expect(
      page
        .locator('[data-canvas-section="use-case"]')
        .getByText("Changed", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("tabpanel", { name: "Inspect" })
        .getByRole("region", { name: "Details" })
        .getByText("Changed", { exact: true }),
    ).toBeVisible();

    await openPanelTab(page, "Changes");
    await expect(changeCount(page)).toHaveText("Change 3 of 5");
    await expect(comparedRail(page).getByRole("listitem")).toHaveText([
      "Before Branch point on fixture-base",
      "Current This branch",
    ]);
    await expect(changesPanel(page).getByText(/^Changed step:/u)).toHaveText([
      `Changed step: ${tourSteps[1]}`,
    ]);
    await expect(
      changesPanel(page).getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
  });

  test("a changed step's link opens its screen on that screen's Changes tab", async ({
    page,
  }) => {
    await page.goto(`/view/${changesTabPaths.tour}/`);
    await openPanelTab(page, "Changes");
    await changesPanel(page)
      .getByRole("link", { name: tourSteps[1], exact: true })
      .click();
    await expect(page).toHaveURL(`/view/${changesTabPaths.details}/`);
    await expect(
      page.getByRole("tab", { name: "Changes", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(changeCount(page)).toHaveText("Change 2 of 5");
  });
});

test.describe("in the compact layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the entry bar names a listed use case Changed", async ({ page }) => {
    await page.goto(`/view/${changesTabPaths.tour}/`);
    await expect(
      page.locator("[data-entry-bar]").getByText("Changed", { exact: true }),
    ).toBeVisible();
  });
});
