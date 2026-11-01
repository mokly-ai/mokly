import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import { unexpectedDesignScripts as servedScripts } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentInspector(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const unexpectedDesignScripts = () =>
    mode === "static"
      ? 'script:not([src="/mokly-viewer/client/inspector.js"])'
      : servedScripts();
  const { componentDesignUrl } = componentDesignFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  test.describe("portable inspector", () => {
    test.use({ javaScriptEnabled: false });
    for (const viewport of ["desktop", "mobile"] as const) {
      test(`${viewport}: inspector icons open, switch, and close without scripts`, async ({
        page,
      }) => {
        await page.setViewportSize(
          viewport === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
        );
        await page.goto(
          componentDesignUrl("design/components/pages/toolbar", viewport),
        );
        const inspector = page.getByRole("region", {
          name: "Inspector",
          exact: true,
        });
        await expect(inspector.locator(":scope > details[open]")).toHaveCount(
          1,
        );
        for (const name of ["Nested components", "Props", "Usage", "Details"]) {
          const icon = inspector.getByRole("button", { name, exact: true });
          await icon.focus();
          await expect(icon).toBeFocused();
          await page.keyboard.press("Space");
          await expect(inspector.locator(":scope > details[open]")).toHaveCount(
            1,
          );
          await expect(
            inspector.locator(":scope > details[open] > summary"),
          ).toHaveAttribute("aria-label", name);
          await expect(
            inspector.getByRole("region", { name, exact: true }),
          ).toBeVisible();
        }
        await inspector
          .getByRole("button", { name: "Details", exact: true })
          .click();
        await expect(inspector.locator(":scope > details[open]")).toHaveCount(
          0,
        );
        await expect(inspector).toHaveCSS("height", "46px");
        await inspector
          .getByRole("button", { name: "Props", exact: true })
          .click();
        await inspector.locator("details[open] [data-inspector-close]").click();
        await expect(inspector.locator(":scope > details[open]")).toHaveCount(
          0,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport === "desktop" ? 1440 : 390);
        await expect(page.locator(unexpectedDesignScripts())).toHaveCount(0);
      });
    }
  });

  test("the shared inspector opens and closes inside sandboxed Browse frames", async ({
    page,
  }) => {
    await page.goto("/view/design/components/overview/");
    for (const viewport of ["desktop", "mobile"] as const) {
      const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
      const inspector = frame.getByRole("region", {
        name: "Inspector",
        exact: true,
      });
      await inspector
        .getByRole("button", { name: "Usage", exact: true })
        .click();
      await expect(
        inspector.locator('[data-usage-section="used-by"]'),
      ).toBeVisible();
      await inspector
        .getByRole("button", { name: "Usage", exact: true })
        .click();
      await expect(inspector.locator(":scope > details[open]")).toHaveCount(0);
      await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
    }
  });
}
