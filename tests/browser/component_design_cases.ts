import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { designCases } from "./design_catalogue.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

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

/** Run the same assertions against each catalogue delivery. */
export function registerComponentDesign(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  // A document's width does not depend on its delivery, so Serve alone
  // checks that each Canvas artboard fits its viewport.
  if (mode === "serve")
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

      // No Canvas screen draws a screen's own prop change beside a component
      // change, so this requirement keeps its older subject (question Q5).
      test("an independent screen change keeps its own Changes row", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl(
            "design/components/inspection/inspection-direct-change",
            viewport,
          ),
        );
        const count =
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
        await expect(page.locator(count)).toHaveText("2");
        await expect(
          page.locator(".ce-selected-instance .mbk-props"),
        ).toContainText("Get started");
        if (viewport === "desktop")
          await expect(page.locator(".mbk-nav-scroll a")).toContainText([
            "Welcome",
            "Action",
            "Default",
          ]);
      });
    });
  }
}
