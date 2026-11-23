/**
 * Changed-view marks in Serve follow real background classifications: the
 * theme and viewport marks, the `Changed views` Details row, and the shown
 * status move without reloading frames, follow the selected saved variant,
 * and decide the first view that a Changes arrival opens.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { shellRoot } from "./browse_assertions.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  expectNoCompareModes,
  navRow,
} from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  canvasFrame,
  expectFrameSource,
  NARROW_WINDOW,
  openCatalogueSheet,
  openPanelTab,
  setFrames,
} from "./workspace_actions.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

const DARK_VIEWS = "Changed viewsMobile · Dark, Desktop · Dark";

/**
 * The change dots of the Frames filter that show, on the toggles of one
 * axis, with Inspect selected; the compact layout opens the panel's sheet.
 */
async function shownMarks(
  page: Page,
  axis: "scheme" | "viewport",
): Promise<Locator> {
  await openPanelTab(page, "Inspect");
  return page
    .locator(`[data-view-changed="${axis}"]`)
    .filter({ visible: true });
}

/** The Dark toggle names the wording of its scheme mark as its description. */
async function expectDarkMarked(page: Page): Promise<void> {
  await expect(
    page.locator('[data-frames-toggle="dark"]'),
  ).toHaveAccessibleDescription("Other theme changed");
}

/** The shown status and whether the Changes tab's band offers modes. */
async function expectShownStatus(
  page: Page,
  path: string,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await awaitRoutedDetail(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  // Show the panel, which the compact layout holds in a sheet, so a check
  // that its band is absent reads the panel's tabs.
  await openPanelTab(page, "Inspect");
  if (!comparison) return expectNoCompareModes(page);
  await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
}

test("a background classification moves the marks without reloading the frames", async ({
  page,
  changes,
}) => {
  // At the head commit nothing is changed; the base move classifies Dusk.
  await changes.moveBase("head");
  await page.goto(`/view/${changes.paths.darkOnly}/`);
  // The Frames filter hides the Dark frames, so its Dark toggle marks the
  // change that the base move finds in them.
  await setFrames(page, { light: true, dark: false });
  const row = page.locator("[data-workspace-changed-views]");
  await expect(await shownMarks(page, "scheme")).toHaveCount(0);
  await expect(row).toBeHidden();
  const frame = page.frameLocator(canvasFrame("mobile"));
  await expect(frame.locator("h1")).toHaveText("Dusk screen");
  await frame
    .locator("body")
    .evaluate((body) => body.setAttribute("data-test-retained", "true"));

  await changes.moveBase("base");

  await expect(await shownMarks(page, "scheme")).toHaveCount(1);
  await expectDarkMarked(page);
  await expect(row).toHaveText(DARK_VIEWS);
  await expect(frame.locator("body")).toHaveAttribute(
    "data-test-retained",
    "true",
  );
});

test("component view evidence follows the selected saved variant", async ({
  page,
}) => {
  await page.goto(`/view/${viewerStatePaths.chip}/`);
  // The set shows its Light frames alone; the filter keeps that choice
  // through the in-shell navigation to the variant.
  await setFrames(page, { light: true, dark: false });
  const row = page.locator("[data-workspace-changed-views]");
  await expect(await shownMarks(page, "scheme")).toHaveCount(0);
  await expect(row).toBeHidden();
  await expectShownStatus(page, viewerStatePaths.chip, "Unmodified", false);

  // A set's Variants row selects a frame and keeps the route, so the
  // catalogue's row of the variant opens it as its own entry.
  await navRow(page, viewerStatePaths.nightChip).click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${viewerStatePaths.nightChip}/$`, "u"),
  );
  await expect(await shownMarks(page, "scheme")).toHaveCount(1);
  await expectDarkMarked(page);
  await expect(row).toBeVisible();
  await expect(row).toHaveText(DARK_VIEWS);
  await expectShownStatus(
    page,
    viewerStatePaths.nightChip,
    "Unmodified",
    false,
  );

  // Showing the Dark frames shows the changed views.
  await setFrames(page, { dark: true, light: false });
  await expectShownStatus(page, viewerStatePaths.nightChip, "Changed", true);
});

test("Changes lands on the first changed view and every other arrival stays sticky", async ({
  page,
  changes,
}) => {
  const dusk = changes.paths.darkOnly;
  const stable = changes.paths.unchanged;
  // The compact layout shows the arrival's view alone: its one frame is the
  // selection's view.
  await page.setViewportSize(NARROW_WINDOW);
  const scheme = page.locator(shellRoot);
  const picker = page.getByRole("combobox", { name: "Frame", exact: true });
  const mobileFrame = page.locator(canvasFrame("mobile"));
  const darkMobileFrame = page.locator(canvasFrame("mobile", "dark"));
  await page.goto(`/view/${stable}/`);

  await openCatalogueSheet(page);
  await navRow(page, dusk).click();
  await expect(page).toHaveURL(new RegExp(`/view/${dusk}/$`, "u"));
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(picker).toHaveValue("mobile-light");
  await expectFrameSource(mobileFrame, /dusk\/index\.mobile\.html/u);
  await expectShownStatus(page, dusk, "Unmodified", false);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/view/${stable}/$`, "u"));
  await expectShownStatus(page, stable, "Unmodified", false);

  await openCatalogueSheet(page);
  await chooseFilter(page, "changed");
  await expect(navRow(page, dusk)).toBeVisible();
  await navRow(page, dusk).click();

  // The landing's address names its Mobile viewport.
  const landed = new RegExp(`/view/${dusk}/\\?viewport=mobile$`, "u");
  await expect(page).toHaveURL(landed);
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "dark");
  await expect(picker).toHaveValue("mobile-dark");
  // The canvas shows the changed view's frame, Mobile · Dark, alone.
  await expect(darkMobileFrame).toBeVisible();
  await expect(page.locator(canvasFrame("desktop", "dark"))).toBeHidden();
  await expectFrameSource(darkMobileFrame, /dusk\/index\.mobile\.dark\.html/u);
  // The scheme toggles stay on, so no scheme toggle is marked. The viewport
  // toggles show the landing's Mobile viewport, so the Desktop toggle hides
  // Desktop · Dark and is marked; Inspect's head names the changed views.
  await expect(await shownMarks(page, "scheme")).toHaveCount(0);
  await expect(await shownMarks(page, "viewport")).toHaveCount(1);
  await expect(
    page.locator('[data-frames-toggle="desktop"]'),
  ).toHaveAccessibleDescription("Other viewport changed");
  await expect(page.locator("[data-workspace-changed-views]")).toHaveText(
    DARK_VIEWS,
  );
  await expectShownStatus(page, dusk, "Changed", true);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/view/${stable}/$`, "u"));
  await expectShownStatus(page, stable, "Unmodified", false);

  await page.goForward();
  await expect(page).toHaveURL(landed);
  await page.reload();
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(picker).toHaveValue("mobile-light");
  await expect(await shownMarks(page, "scheme")).toHaveCount(0);
  await expectShownStatus(page, dusk, "Unmodified", false);
});
