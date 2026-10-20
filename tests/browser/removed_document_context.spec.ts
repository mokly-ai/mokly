/**
 * A removed document's baseline context on the copied comparison output,
 * under the removed previews and folder contracts, in a narrow and a wide
 * window. The removed Markdown document keeps its title and its base-side
 * folder label in the crumbs and in Details, shows its previous version
 * without comparison controls, and is a row only in Changes, outside any
 * folder. A current document opens at its fragment, keeps it after a reload,
 * and its catalogue link navigates the shell.
 */

import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { chooseFilter, comparisonIndex, snapshotOf } from "./comparison_ui.js";

const CONTROLS = "[data-diff-stage], [data-diff-mode], [data-viewport-option]";

for (const width of [390, 1280])
  test.describe(`${width}px window`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("a removed document keeps its baseline context only in Changes", async ({
      page,
      request,
      baseURL,
    }) => {
      const removedPath = comparisonPaths.removedDocument;
      const snapshot = snapshotOf(
        await comparisonIndex(request, baseURL),
        removedPath,
      );
      await page.goto(`/view/${removedPath}/?snapshot=${snapshot}`);
      await expect(page.locator(".mbk-screen-head h2")).toHaveText(
        "Retired document",
      );
      const crumbs = page.getByLabel("Catalogue location");
      await expect(crumbs).toHaveText("Notes");
      await expect(crumbs.locator("a")).toHaveCount(0);
      await expect(page.locator("#mb-main")).toContainText(
        "Showing previous version",
      );
      await expect(
        page.frameLocator("[data-mokly-preview] iframe").locator("body"),
      ).toContainText("Historical document");
      await expect(page.locator("[data-mokly-preview-retry]")).toHaveCount(0);
      await expect(page.locator(CONTROLS)).toHaveCount(0);
      // Details name the base-side folder too.
      await page.locator("[data-mokly-details] summary").click();
      const location = page.locator(".mbk-meta-row", {
        has: page.locator(".mbk-meta-k", { hasText: "Location" }),
      });
      await expect(location).toHaveText("LocationNotes");

      if (width < 700)
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
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
      const document = page.frameLocator(".mbk-stage-embed iframe");
      await expect(document.locator("#overview")).toBeInViewport();
      await expect(page.locator(CONTROLS)).toHaveCount(0);
      await page.reload();
      await expect(document.locator("#overview")).toBeInViewport();
      await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
        "data-mokly-frame-state",
        "ready",
      );
      await document
        .getByRole("link", { name: "Open the stable screen", exact: true })
        .click();
      await expect(page.locator(".mbk-screen-head h2")).toHaveText(
        "Stable screen",
      );
    });
  });
