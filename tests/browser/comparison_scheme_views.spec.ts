import { expect, type Locator, type Page } from "@playwright/test";

import { accentFill, shellRoot } from "./browse_assertions.js";
import { expectNoComparison } from "./comparison_absence.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonFrames,
  modeButton,
} from "./comparison_ui.js";
import {
  canvasFrame,
  chooseScheme,
  expectFrameSource,
  NARROW_WINDOW,
  openPanelTab,
  revealInPanel,
  setFrames,
} from "./workspace_actions.js";

const SCHEME_DOT = '[data-view-changed="scheme"]';
const VIEWPORT_DOT = '[data-view-changed="viewport"]';

/** Inspect's Frames filter, whose toggles carry the change marks. */
function framesFilter(page: Page): Locator {
  return page.getByRole("group", {
    name: "Frames",
    exact: true,
    includeHidden: true,
  });
}

/** The mark's painted geometry, so a hidden dot cannot pass as a drawn one. */
function dotStyle(mark: Locator) {
  return mark.evaluate((dot) => {
    const style = getComputedStyle(dot);
    return {
      display: style.display,
      fill: style.backgroundColor,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      width: style.width,
    };
  });
}

/**
 * Expect the status of the shown views, and whether the entry offers compare
 * modes, which the band of its Changes tab holds. The tab of an entry that
 * has one opens first, also from the compact layout's closed sheet, so the
 * check never passes only because Inspect is selected.
 */
async function expectShownStatus(
  page: Page,
  path: string,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await awaitRoutedDetail(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  const changes = page.getByRole("tab", {
    name: "Changes",
    exact: true,
    includeHidden: true,
  });
  if (await changes.count()) await openPanelTab(page, "Changes");
  const modes = page.getByRole("group", { name: "Comparison mode" });
  if (comparison) await expect(modes).toBeVisible();
  else await expect(modes).toBeHidden();
}

test("a dark-only change marks the views it hides and opens on one", async ({
  page,
}) => {
  const diffs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      diffs.push(request.url());
  });
  // The compact layout shows one frame, Mobile · Light, whose view stays
  // unmodified.
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(`/view/${comparisonPaths.darkOnly}/?comparison=side`);
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
  // The deep link asked for Side by side, but the shown view is unmodified,
  // so it offers no mode and keeps its current frame: no frame compares.
  await expectShownStatus(page, comparisonPaths.darkOnly, "Unmodified", false);
  await expectNoComparison(page);
  expect(diffs).toEqual([]);

  // The wide canvas shows every frame, so no toggle hides a changed view.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);
  const filter = framesFilter(page);
  await revealInPanel(page, filter);
  await expect(filter.locator(`${SCHEME_DOT}, ${VIEWPORT_DOT}`)).toHaveCount(0);

  // With Dark off, the Dark toggle hides the changed views and is marked.
  await setFrames(page, { light: true, dark: false });
  await expectShownStatus(page, comparisonPaths.darkOnly, "Unmodified", false);
  await revealInPanel(page, filter);
  const dark = page.locator('[data-frames-toggle="dark"]');
  await expect(filter.locator(SCHEME_DOT)).toBeVisible();
  await expect(dark).toHaveAccessibleDescription("Other theme changed");
  await expect(filter.locator(VIEWPORT_DOT)).toHaveCount(0);
  expect(await dotStyle(filter.locator(SCHEME_DOT))).toEqual({
    display: "block",
    fill: accentFill,
    radius: "50%",
    shadow: "rgb(255, 255, 255) 0px 0px 0px 1.5px",
    width: "6px",
  });
  const row = page.locator("[data-workspace-changed-views]");
  await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");

  // With Desktop off too, the Desktop toggle hides Desktop · Dark.
  await setFrames(page, { mobile: true, desktop: false });
  await expect(filter.locator(VIEWPORT_DOT)).toBeVisible();
  await expect(
    page.locator('[data-frames-toggle="desktop"]'),
  ).toHaveAccessibleDescription("Other viewport changed");

  // The Dark frames alone hide no changed view of their scheme.
  await setFrames(page, { dark: true, light: false });
  await expect(filter.locator(SCHEME_DOT)).toBeHidden();
  await expect(dark).not.toHaveAttribute("aria-describedby", /.*/u);
  await expect(filter.locator(VIEWPORT_DOT)).toBeVisible();
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);

  // In the compact layout, a deep link to a changed view opens on its
  // comparison: the frame picker picks that view's frame, which compares.
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(
    `/view/${comparisonPaths.darkOnly}/?viewport=mobile&scheme=dark&comparison=side`,
  );
  await expect(page.getByRole("combobox", { name: "Frame" })).toHaveValue(
    "mobile-dark",
  );
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(comparisonFrames(page)).toHaveCount(2);
  await expect(comparisonFrames(page).last()).toHaveAttribute(
    "data-mokly-preview-source",
    /\/screens\/dusk\/index\.mobile\.dark\.html$/u,
  );
});

test("a light fallback rejects an ineligible comparison deep link", async ({
  page,
}) => {
  const diffs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      diffs.push(request.url());
  });
  await page.goto(
    `/view/${comparisonPaths.unchanged}/?viewport=mobile&scheme=dark&comparison=side`,
  );
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  // The light-only screen stands on the canvas as its Light frames alone.
  for (const viewport of ["mobile", "desktop"] as const)
    await expectFrameSource(
      page.locator(canvasFrame(viewport)),
      new RegExp(`screens/stable/index\\.${viewport}\\.html$`),
    );
  await expect(
    page.locator('iframe[data-workspace-color-scheme="dark"]'),
  ).toHaveCount(0);
  await expectShownStatus(page, comparisonPaths.unchanged, "Unmodified", false);
  // The rejected deep link leaves the current frames: no frame compares.
  await expect(comparisonFrames(page)).toHaveCount(0);
  expect(diffs).toEqual([]);
});

test("a light-only screen keeps light frames and says so", async ({ page }) => {
  await page.goto(`/view/${comparisonPaths.consumer}/`);
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "stable");
  await page.click(
    `a[data-nav-row][data-route="${comparisonPaths.unchanged}/index.html"]`,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Stable screen");
  // Below the layout breakpoint the compact layout keeps the light frame
  // under Dark: its picker lists the Light frames alone, and the one frame's
  // label names Light. The test above checks the canvas.
  await page.setViewportSize(NARROW_WINDOW);
  const shown = page.locator(
    ".mbk-canvas-cell:not([hidden]) iframe[data-workspace-frame]",
  );
  await expect(shown).toHaveCount(1);
  await expectFrameSource(shown, /screens\/stable\/index\.mobile\.html$/);
  await expect(
    page.getByRole("combobox", { name: "Frame" }).locator("option"),
  ).toHaveText(["Mobile · Light", "Desktop · Light"]);
  const label = page.locator(".mbk-canvas-frame-name:visible");
  await expect(label).toHaveText("stable · Mobile · Light");

  await chooseScheme(page, "light");
  await expect(label).toHaveText("stable · Mobile · Light");
  await expectFrameSource(shown, /screens\/stable\/index\.mobile\.html$/);
});
