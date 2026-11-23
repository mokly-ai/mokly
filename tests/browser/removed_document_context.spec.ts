/**
 * A removed document's baseline context on the copied comparison output,
 * under the removed previews and folder contracts, in a narrow and a wide
 * window. The removed Markdown document keeps its title, its path without
 * crumb links and its base-side folder label in Inspect's head, shows its
 * previous version without comparison controls, and is a row only in
 * Changes, outside any folder. A current document opens at its fragment,
 * keeps it after a reload, and its catalogue link navigates the shell.
 */

import { expect, type Page } from "@playwright/test";

import { expectNoComparison } from "./comparison_absence.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { chooseFilter, comparisonIndex, snapshotOf } from "./comparison_ui.js";
import { documentFaces, loadedViewerFaces } from "./document_faces.js";
import { inspectHead, inspectTitle } from "./inspect_head.js";
import {
  DOCUMENT_FRAME,
  openCatalogueSheet,
  revealInPanel,
} from "./workspace_actions.js";

/** A document offers no comparison and has no Frames filter. */
async function expectNoControls(page: Page): Promise<void> {
  await expectNoComparison(page);
  await expect(page.locator("[data-frames-toggle]")).toHaveCount(0);
}

for (const width of [390, 1280])
  test.describe(`${width}px window`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("a removed document keeps its baseline context only in Changes", async ({
      page,
      request,
      baseURL,
    }) => {
      const removedPath = comparisonPaths.removedDocument;
      const index = await comparisonIndex(request, baseURL);
      const snapshot = snapshotOf(index, removedPath);
      await page.goto(`/view/${removedPath}/?snapshot=${snapshot}`);
      await expect(inspectTitle(page)).toHaveText("Retired document");
      // Inspect's Path row is the crumb trail. The base-side folder has no
      // current page or row, so no segment links; the Location row below
      // names the folder.
      const crumbs = inspectHead(page).locator("[data-inspect-path]");
      await expect(crumbs.locator("code")).toHaveText(removedPath);
      await expect(crumbs.locator("a, button")).toHaveCount(0);
      await expect(page.locator("#mb-main")).toContainText(
        "Showing previous version",
      );
      const previous = page.frameLocator("[data-mokly-preview] iframe");
      await expect(previous.locator("body")).toContainText(
        "Historical document",
      );
      // The previous version keeps its bytes; its faces load from its generation.
      await expect
        .poll(() => documentFaces(previous.locator("html")))
        .toEqual(
          loadedViewerFaces(
            new URL(
              `${index.comparisonUrl}snapshots/mokly-viewer/fonts/`,
              baseURL,
            ).href,
          ),
        );
      await expect(page.locator("[data-mokly-preview-retry]")).toHaveCount(0);
      await expectNoControls(page);
      // Inspect's head names the base-side folder too; in the compact layout
      // it stands in the panel's sheet.
      await revealInPanel(page, inspectHead(page));
      const location = inspectHead(page).locator(".mbk-meta-row", {
        has: page.locator(".mbk-meta-k", { hasText: "Location" }),
      });
      await expect(location).toHaveText("LocationNotes");

      if (width < 700) await openCatalogueSheet(page);
      const removed = page.locator(
        `nav.mbk-nav [data-entry-id="${removedPath}"]`,
      );
      await expect(removed).toBeHidden();
      await chooseFilter(page, "changed");
      await expect(removed).toBeVisible();
      await expect(
        page.locator('[data-nav-folder="folder:notes"]'),
      ).toHaveCount(0);
      expect(
        await removed.evaluate(
          (row) => row.closest("details[data-nav-folder]") === null,
        ),
      ).toBe(true);
      await chooseFilter(page, "all");
      await expect(removed).toBeHidden();

      await page.goto(
        `/view/${comparisonPaths.currentDocument}/?fragment=overview`,
      );
      const document = page.frameLocator(DOCUMENT_FRAME);
      await expect(document.locator("#overview")).toBeInViewport();
      await expectNoControls(page);
      await page.reload();
      await expect(document.locator("#overview")).toBeInViewport();
      await expect(page.locator(DOCUMENT_FRAME)).toHaveAttribute(
        "data-mokly-frame-state",
        "ready",
      );
      await document
        .getByRole("link", { name: "Open the stable screen", exact: true })
        .click();
      await expect(inspectTitle(page)).toHaveText("Stable screen");
    });
  });
