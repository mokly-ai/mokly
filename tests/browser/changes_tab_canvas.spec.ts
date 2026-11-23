/**
 * What the canvas shows for the Changes tab's compare modes, on the copied
 * comparison output, whose changed screen shows four frames. Side by side
 * names each frame in a chip and compares the chosen chip's frame. The canvas
 * shows the chosen mode only while Changes is the selected tab: Inspect shows
 * the current frames, and a return to Changes shows the mode again without a
 * new comparison request.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  changesPanel,
  comparisonDocumentRequests,
  frameFigure,
} from "./changes_tab_ui.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  comparisonFrames,
  comparisonIndex,
  modeButton,
  showMode,
} from "./comparison_ui.js";
import { openPanelTab } from "./panel_actions.js";

test.use({ viewport: { width: 1600, height: 1000 } });

/** The comparison document of one version of one frame, by its title. */
function versionFrame(page: Page, title: string): Locator {
  return page.getByTitle(title, { exact: true });
}

test("Side by side names each shown frame in a chip, compares the first, and compares a chosen chip's frame", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await openPanelTab(page, "Changes");
  await modeButton(page, "Side by side").click();
  const chips = changesPanel(page).getByRole("group", {
    name: "Compared frame",
  });
  await expect(chips).toMatchAriaSnapshot(`
    - group "Compared frame":
      - /children: equal
      - button "Desktop · Light" [pressed]
      - button "Mobile · Light"
      - button "Desktop · Dark"
      - button "Mobile · Dark"
  `);
  await expect(comparisonFrames(page)).toHaveCount(2);
  await expect(versionFrame(page, "Before — desktop — light")).toBeVisible();
  await expect(versionFrame(page, "Current — desktop — light")).toBeVisible();

  await chips.getByRole("button", { name: "Mobile · Dark" }).click();
  await expect(
    chips.getByRole("button", { name: "Mobile · Dark" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(comparisonFrames(page)).toHaveCount(2);
  await expect(versionFrame(page, "Before — mobile — dark")).toBeVisible();
  await expect(versionFrame(page, "Current — mobile — dark")).toBeVisible();
});

test("Inspect shows the current frames while Overlay stays chosen, and a return to Changes shows Overlay without a new comparison request", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const documents = comparisonDocumentRequests(page, index.comparisonUrl);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await openPanelTab(page, "Changes");
  // Overlay shows both versions in each of the four frames.
  await showMode(page, "Overlay", 8);
  await expect.poll(documents).toBe(8);

  await openPanelTab(page, "Inspect");
  await expect(comparisonFrames(page)).toHaveCount(0);
  for (const label of [
    "Desktop · Light",
    "Mobile · Light",
    "Desktop · Dark",
    "Mobile · Dark",
  ])
    await expect(
      frameFigure(page, label)
        .locator("iframe")
        .contentFrame()
        .getByRole("heading", { name: "After screen" }),
    ).toBeVisible();

  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(comparisonFrames(page)).toHaveCount(8);
  for (const frame of await comparisonFrames(page).all())
    await expect(
      frame
        .contentFrame()
        .getByRole("heading", { name: /^(?:Before|After) screen$/u }),
    ).toBeVisible();
  expect(documents()).toBe(8);
});
