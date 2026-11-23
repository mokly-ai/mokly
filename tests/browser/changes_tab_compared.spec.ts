/**
 * Compared in the right panel's Changes tab, on the copied comparison output,
 * whose base is `fixture-base`: a changed screen names both versions, an
 * added screen its current version alone, and a removed screen its version
 * before alone, each with the line that says why.
 */

import { expect } from "@playwright/test";

import { comparedRail } from "./changes_tab_ui.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, snapshotOf } from "./comparison_ui.js";
import { openPanelTab } from "./panel_actions.js";

test("Compared names both versions of a changed screen, and the one version of an added and a removed screen", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    comparisonPaths.removedScreen,
  );
  const versions = comparedRail(page).getByRole("listitem");
  const note = comparedRail(page).getByRole("paragraph");

  await page.goto(`/view/${comparisonPaths.changed}/`);
  await openPanelTab(page, "Changes");
  await expect(versions).toHaveText([
    "Before Branch point on fixture-base",
    "Current This branch",
  ]);
  await expect(note).toHaveCount(0);

  await page.goto(`/view/${comparisonPaths.added}/`);
  await openPanelTab(page, "Changes");
  await expect(versions).toHaveText(["Current This branch"]);
  await expect(note).toHaveText(
    "Added on this branch, so there is no base to compare.",
  );

  await page.goto(
    `/view/${comparisonPaths.removedScreen}/?snapshot=${snapshot}`,
  );
  await openPanelTab(page, "Changes");
  await expect(versions).toHaveText(["Before Branch point on fixture-base"]);
  await expect(note).toHaveText(
    "Removed on this branch, so there is no current version to compare.",
  );
});
