import { expect, type Locator } from "@playwright/test";

import { test } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

type Viewport = "desktop" | "mobile";

/** The Changes count of a desktop catalogue; a phone draws no catalogue. */
function changesCount(viewport: Viewport, count: string): string[] {
  return viewport === "desktop" ? [count] : [];
}

/** Top margins of the sentence and style list nested under the first file. */
function nestedSpacing(files: Locator) {
  return files.evaluate((list) => {
    const item = list.querySelector(":scope > li");
    const margin = (selector: string) => {
      const element = item?.querySelector(selector);
      return element ? getComputedStyle(element).marginTop : "";
    };
    return { sentence: margin(":scope > p"), styles: margin(":scope > ul") };
  });
}

export function registerDesignStylesheetEvidence() {
  test.beforeEach(({ allowBrowserError, baseURL }) =>
    documentFavicon(allowBrowserError, baseURL!),
  );
  const { designDocumentUrl } = designDocumentFixture();

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} stylesheet evidence designs`, () => {
      test.use({
        viewport:
          viewport === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
      });

      test("each file's sentence and styles sit under it with the card spacing", async ({
        page,
      }) => {
        for (const route of [
          "design/canvas/evidence/styles",
          "design/canvas/evidence/page",
        ]) {
          await page.goto(designDocumentUrl(route, viewport));
          const files = page.locator(".mbk-evidence-files");
          await expect(files, route).toHaveCount(1);
          expect(await nestedSpacing(files), route).toEqual({
            sentence: "8px",
            styles: "8px",
          });
        }
      });

      test("the shared Excluded and Matched card spaces its excluded file and excluded content with the card spacing", async ({
        page,
      }) => {
        for (const route of [
          "design/canvas/evidence/styles/excluded",
          "design/canvas/evidence/styles",
        ]) {
          await page.goto(designDocumentUrl(route, viewport));
          const spacing = await page
            .locator(".cv-evidence .mbk-comparison-evidence")
            .evaluate((card) =>
              [
                ...card.querySelectorAll(":scope > .mbk-evidence-files ~ *"),
              ].map(
                (element) =>
                  `${element.tagName.toLowerCase()} ${getComputedStyle(element).marginTop}`,
              ),
            );
          // The excluded sentence, its lead and its list, then Welcome's
          // excluded content, each list followed by fourteen pixels.
          expect(spacing, route).toEqual([
            "p 14px",
            "p 8px",
            "ul 8px",
            "p 14px",
          ]);
        }
      });

      test("the changed page opens as one document, which has no comparison controls", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl("design/canvas/evidence/page/inspect", viewport),
        );
        await page
          .getByRole("region", { name: "Panel", exact: true })
          .getByRole("link", { name: "Changes", exact: true })
          .click();
        await expect(page).toHaveURL(
          designDocumentUrl("design/canvas/evidence/page", viewport),
        );
        await expect(page.locator(".mbk-nav-filter-count")).toHaveText(
          changesCount(viewport, "5"),
        );
        await expect(
          page.getByRole("list", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(
          page.locator('.cv-frame[data-cv-kind="document"]'),
        ).toContainText("Next steps");
        const evidence = page.locator(".cv-evidence [data-page-evidence]");
        await expect(evidence).toContainText(
          "Changes to these files may affect this page:",
        );
        await expect(
          evidence.locator(".mbk-evidence-files > li > p"),
        ).toHaveText([
          "These changed styles also apply outside the changed components on this page:",
          "Changed styles that apply to this page:",
          "This change can apply anywhere on the page, so the page stays in Changes:",
        ]);
      });

      test("an affected screen opens in its comparison", async ({ page }) => {
        await page.goto(
          designDocumentUrl("design/canvas/components/usage", viewport),
        );
        await page
          .locator('[data-usage-section="affected"]')
          .getByRole("link", { name: "Welcome" })
          .click();
        await expect(page).toHaveURL(
          designDocumentUrl("design/canvas/components/affected", viewport),
        );
        // Welcome stays out of Changes and shows no status, yet it compares
        // its two versions side by side.
        await expect(page.locator(".mbk-nav-filter-count")).toHaveText(
          changesCount(viewport, "4"),
        );
        await expect(page.locator(".mbk-entry-status")).toHaveCount(0);
        await expect(
          page.locator(".cv-frame:visible .cv-frame-side"),
        ).toHaveText(["Before", "Current"]);
      });
    });
  }

  // A phone shows the comparison with its panel sheet closed, so the desktop
  // artboard shows the comparison details.
  test("desktop: an affected screen's details name the changed component and return to it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      designDocumentUrl("design/canvas/components/affected", "desktop"),
    );
    await expect(
      page
        .getByRole("list", { name: "Comparison mode" })
        .getByRole("link", { name: "Side by side", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const evidence = page.locator(".cv-evidence [data-workspace-evidence]");
    await expect(evidence.locator(":scope > p")).toHaveText([
      "Changed component: Action",
      "Changed components that this screen uses affect its preview.",
    ]);
    await expect(evidence).not.toContainText("No changes to this screen.");
    await evidence.getByRole("link", { name: "Action", exact: true }).click();
    await expect(page).toHaveURL(
      designDocumentUrl("design/canvas/components/compare/current", "desktop"),
    );
  });
}
