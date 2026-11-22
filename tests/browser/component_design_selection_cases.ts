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
    // The removal branch removed Compact and Farewell, its former consumer.
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("2");
    const changed = page.locator(
      '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
    );
    await expect(changed).toHaveCount(1);
    await expect(changed).toContainText(["Action"]);
    await expect(
      page.locator(".mbk-nav-scroll a[aria-current='page']"),
    ).toContainText("Compact · Removed");
  });

  test("a removed consumer keeps independent Changes membership", async ({
    page,
  }) => {
    // A desktop's catalogue lists Farewell's own Removed row beside the
    // removed variant's, counts both, and marks only the Action changed.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      designDocumentUrl("design/canvas/components/removed/consumer", "desktop"),
    );
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("2");
    await expect(page.locator(".mbk-nav-scroll a")).toContainText([
      "Farewell · Removed",
      "Compact · Removed",
    ]);
    await expect(
      page.locator(
        '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
      ),
    ).toHaveCount(1);
    // A phone draws no catalogue; its Changes tab counts Farewell first
    // among the branch's two changes.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      designDocumentUrl(
        "design/canvas/components/removed/consumer-changes",
        "mobile",
      ),
    );
    await expect(
      page.getByText("Change 1 of 2", { exact: true }),
    ).toBeVisible();
  });
}
