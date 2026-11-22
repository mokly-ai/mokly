import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentSurfaces(
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

  // A phone's top bar opens the catalogue from its menu glyph.
  test("mobile: the top bar's menu glyph is centered in its target", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      designDocumentUrl("design/library/chrome/top-bar", "mobile"),
    );
    const menu = page.locator(".mbk-menu");
    const svg = menu.locator("svg");
    await expect(svg).toBeVisible();
    const target = (await menu.boundingBox())!;
    const mark = (await svg.boundingBox())!;
    expect(mark.x + mark.width / 2).toBeCloseTo(target.x + target.width / 2, 0);
    expect(mark.y + mark.height / 2).toBeCloseTo(
      target.y + target.height / 2,
      0,
    );
  });
}
