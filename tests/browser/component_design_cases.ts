import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { designCases } from "./design_catalogue.js";
import { builtCatalogueDelivery } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

/** Every screen of the Canvas design family, from the frozen inventory. */
const CANVAS_SCREENS = designCases
  .filter(
    (entry) =>
      entry.kind === "screen" && entry.path.startsWith("design/canvas/"),
  )
  .map((entry) => entry.path);

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
} as const;

/**
 * The rows that the Action branch marks changed in a desktop catalogue: the
 * changed Action and its saved variants. A phone draws no catalogue.
 */
const CHANGED_ROWS = {
  desktop: ["Action", "Default", "Disabled", "Secondary"],
  mobile: [],
} as const;

/**
 * The rows that a desktop catalogue marks changed where Welcome also changed
 * its own props: Welcome's own row, then the changed Action's rows.
 */
const DIRECT_ROWS = {
  desktop: ["Welcome", ...CHANGED_ROWS.desktop],
  mobile: [],
} as const;

/** Run the same assertions against each catalogue delivery. */
export function registerComponentDesign() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture();

  // A document's width does not depend on its delivery, so Serve alone
  // checks that each Canvas artboard fits its viewport.
  if (!builtCatalogueDelivery())
    for (const route of CANVAS_SCREENS)
      test(`${route}: both artboards fit their viewport's width`, async ({
        page,
      }) => {
        for (const [viewport, size] of Object.entries(VIEWPORTS)) {
          await page.setViewportSize(size);
          await page.goto(designDocumentUrl(route, viewport));
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(
            overflow,
            `${route} ${viewport} has no document overflow`,
          ).toBe(false);
        }
      });

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} component designs`, () => {
      test.use({ viewport: VIEWPORTS[viewport] });
      test("a component-only change lists the component and its variants, not its affected screens", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl("design/canvas/components/usage", viewport),
        );
        await expect(
          page.locator('[data-usage-section="affected"]').getByRole("link"),
        ).toHaveText(["Welcome", "Details"]);
        await expect(page.locator(".mbk-nav-filter-count")).toHaveText(
          viewport === "desktop" ? ["4"] : [],
        );
        const changed = page.locator(
          '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
        );
        await expect(changed).toHaveCount(CHANGED_ROWS[viewport].length);
        await expect(changed).toContainText([...CHANGED_ROWS[viewport]]);
      });

      // Welcome also changed the label that it gives its own Action, so it
      // keeps its own Changes row beside the component change: a desktop
      // catalogue counts and lists it, the stepper counts it in both
      // viewports, and the current version shows the new label.
      test("an independent screen change keeps its own Changes row", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl(
            "design/canvas/components/affected/direct",
            viewport,
          ),
        );
        await expect(page.locator(".mbk-nav-filter-count")).toHaveText(
          viewport === "desktop" ? ["5"] : [],
        );
        await expect(page.locator(".cv-stepper-count")).toHaveText(
          "Change 1 of 5",
        );
        await expect(
          page.locator('.cv-frame[data-cv-side="after"]:visible'),
        ).toContainText("View details");
        const changed = page.locator(
          '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
        );
        await expect(changed).toHaveCount(DIRECT_ROWS[viewport].length);
        await expect(changed).toContainText([...DIRECT_ROWS[viewport]]);
      });
    });
  }
}
