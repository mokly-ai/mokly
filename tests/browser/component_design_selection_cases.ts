import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentDesignSelection(
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

  // A phone draws no catalogue, so the desktop artboard shows the membership.
  test("desktop: a removed variant keeps its own Changes row under its changed parent", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      designDocumentUrl("design/canvas/components/removed", "desktop"),
    );
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
    const changed = page.locator(
      '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
    );
    await expect(changed).toHaveCount(1);
    await expect(changed).toContainText(["Action"]);
    await expect(
      page.locator(".mbk-nav-scroll a[aria-current='page']"),
    ).toContainText("Compact · Removed");
  });

  for (const viewport of ["desktop", "mobile"] as const) {
    // No Canvas screen draws a removed screen's previous version until
    // decision 34, so the removed consumer keeps its older subject.
    test(`a removed consumer keeps independent ${viewport} Changes membership`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      await page.goto(
        designDocumentUrl(
          "design/components/states/removed-consumer",
          viewport,
        ),
      );
      await expect(
        page.locator(
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count",
        ),
      ).toHaveText("2");
      if (viewport === "desktop") {
        await expect(page.locator(".mbk-nav-scroll a")).toContainText([
          "Farewell",
          "Action",
          "Compact · Removed",
        ]);
        await expect(
          page.locator(
            '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
          ),
        ).toHaveCount(1);
      }
    });
  }
}
