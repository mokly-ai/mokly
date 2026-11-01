/**
 * Changed-view marks in Serve follow real background classifications: the
 * theme and viewport marks, the `Changed views` Details row, and the shown
 * status move without reloading frames, follow the selected saved variant,
 * and decide the first view that a Changes arrival opens.
 */

import { expect, type Page } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { shellRoot } from "./browse_assertions.js";
import { awaitRoutedDetail, chooseFilter, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  chooseScheme,
  chooseVariant,
  expectFrameSource,
} from "./workspace_actions.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

const SCHEME_DOT = '[data-view-changed="scheme"]';
const VIEWPORT_DOT = '[data-view-changed="viewport"]';
const DARK_VIEWS = "Changed viewsMobile · Dark, Desktop · Dark";

/** The shown status and whether the comparison band offers modes. */
async function expectShownStatus(
  page: Page,
  path: string,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await awaitRoutedDetail(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  if (comparison) await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  else await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
}

test("a background classification moves the marks without reloading the frames", async ({
  page,
  changes,
}) => {
  // At the head commit nothing is changed; the base move classifies Dusk.
  await changes.moveBase("head");
  await page.goto(`/view/${changes.paths.darkOnly}/`);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const row = page.locator("[data-workspace-changed-views]");
  await expect(page.locator(SCHEME_DOT)).toBeHidden();
  await expect(row).toBeHidden();
  const frame = page.frameLocator('[data-workspace-frame="mobile"]');
  await expect(frame.locator("h1")).toHaveText("Dusk screen");
  await frame
    .locator("body")
    .evaluate((body) => body.setAttribute("data-test-retained", "true"));

  await changes.moveBase("base");

  await expect(page.locator(SCHEME_DOT)).toBeVisible();
  const described = await page
    .locator('[data-view-changed-text="scheme"]')
    .getAttribute("id");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveAttribute(
    "aria-describedby",
    described!,
  );
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
  const row = page.locator("[data-workspace-changed-views]");
  await expect(page.locator(SCHEME_DOT)).toBeHidden();
  await expect(row).toBeHidden();
  await expectShownStatus(page, viewerStatePaths.chip, "Unmodified", false);

  await chooseVariant(page, "Night");

  await expect(page).toHaveURL(
    new RegExp(`/view/${viewerStatePaths.nightChip}/$`, "u"),
  );
  await expect(page.locator(SCHEME_DOT)).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row).toHaveText(DARK_VIEWS);
  await expectShownStatus(
    page,
    viewerStatePaths.nightChip,
    "Unmodified",
    false,
  );

  await chooseScheme(page, "dark");
  await expectShownStatus(page, viewerStatePaths.nightChip, "Changed", true);
});

test("Changes lands on the first changed view and every other arrival stays sticky", async ({
  page,
  changes,
}) => {
  const dusk = changes.paths.darkOnly;
  const stable = changes.paths.unchanged;
  const scheme = page.locator(shellRoot);
  const viewport = page.getByLabel("Viewport", { exact: true });
  const mobileFrame = page.locator('[data-workspace-frame="mobile"]');
  await page.goto(`/view/${stable}/`);

  await navRow(page, dusk).click();
  await expect(page).toHaveURL(new RegExp(`/view/${dusk}/$`, "u"));
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(viewport).toHaveValue("both");
  await expectFrameSource(mobileFrame, /dusk\/index\.mobile\.html/u);
  await expectShownStatus(page, dusk, "Unmodified", false);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/view/${stable}/$`, "u"));
  await expectShownStatus(page, stable, "Unmodified", false);

  await chooseFilter(page, "changed");
  await expect(navRow(page, dusk)).toBeVisible();
  await navRow(page, dusk).click();

  await expect(page).toHaveURL(new RegExp(`/view/${dusk}/$`, "u"));
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "dark");
  await expect(viewport).toHaveValue("mobile");
  await expectFrameSource(mobileFrame, /dusk\/index\.mobile\.dark\.html/u);
  await expect(page.locator(SCHEME_DOT)).toBeHidden();
  await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
  await expectShownStatus(page, dusk, "Changed", true);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/view/${stable}/$`, "u"));
  await expectShownStatus(page, stable, "Unmodified", false);

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/view/${dusk}/$`, "u"));
  await page.reload();
  await expect(scheme).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(viewport).toHaveValue("both");
  await expect(page.locator(SCHEME_DOT)).toBeVisible();
  await expectShownStatus(page, dusk, "Unmodified", false);
});
