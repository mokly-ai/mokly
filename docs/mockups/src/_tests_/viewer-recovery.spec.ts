import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { screenFile } from "./catalogue-paths";
import { viewerDocumentViolations } from "./viewer-document-policy";

/**
 * How the viewer's stage recovers when it has no catalogue to show: an empty,
 * loading or unavailable publication, a private comparison the package could
 * not read, and a catalogue that needs another viewer version.
 */
for (const viewport of ["desktop", "mobile"] as const)
  for (const scheme of ["light", "dark"] as const) {
    const url = (screen: string, state?: string) =>
      pathToFileURL(
        screenFile(
          "product/viewer/" + screen + (state ? "/" + state : ""),
          viewport,
          scheme,
        ),
      ).href;
    const label = viewport + " " + scheme;
    const size = {
      width: viewport === "mobile" ? 390 : 1440,
      height: viewport === "mobile" ? 844 : 900,
    };

    test("the stage recovers from every state: " + label, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(url("standalone", "empty"));
      await expect(
        page.getByRole("heading", { name: "No publications yet" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Set up publishing" }),
      ).toBeVisible();
      await page.goto(url("standalone", "loading"));
      await expect(page.locator("[aria-busy=true]").first()).toBeVisible();
      await page.goto(url("standalone", "error"));
      await expect(
        page.getByRole("heading", { name: "This publication is unavailable" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Choose another branch" }).click();
      await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
        "data-mkc-screen",
        "product/viewer/switcher",
      );
    });

    // The overlay's words wait for plan Decisions 11 and 12, so this checks
    // only where the drawing shows it: over the whole shown preview.
    test(
      "private comparison recovery covers the preview: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("standalone/catalogue", "comparison"));
        const overlay = page.locator("[data-mkc-stage-overlay]");
        await expect(overlay).toBeVisible();
        const bounds = await page
          .locator("[data-workspace-preview]")
          .evaluate((preview) => {
            const expected = preview.getBoundingClientRect();
            const actual = document
              .querySelector<HTMLElement>("[data-mkc-stage-overlay]")!
              .getBoundingClientRect();
            return {
              bottom: Math.abs(expected.bottom - actual.bottom),
              left: Math.abs(expected.left - actual.left),
              right: Math.abs(expected.right - actual.right),
              top: Math.abs(expected.top - actual.top),
            };
          });
        for (const difference of Object.values(bounds))
          expect(difference).toBeLessThan(1);
      },
    );
  }

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`version failure keeps cloud chrome and closed details: ${viewport} ${scheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport === "mobile" ? 390 : 1440,
        height: 900,
      });
      await page.goto(
        pathToFileURL(
          screenFile("product/viewer/standalone/error", viewport, scheme),
        ).href,
      );
      const link = page.getByRole("link", { name: "Viewer version failure" });
      await expect(
        link.locator("xpath=ancestor::*[@data-mkc-screen]"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: "Related catalogue screens" }),
      ).toBeVisible();
      await expect(link).toHaveCSS("min-height", "44px");
      await link.click();
      const stage = page.locator(".fo-stage-card");
      await expect(page.locator(".mokly-viewer")).toHaveCount(0);
      await expect(page.locator(".fo-top-bar")).toBeVisible();
      // The package's own headline, with no supporting sentence.
      await expect(stage.getByRole("heading")).toHaveText(
        "This catalogue needs a compatible viewer",
      );
      await expect(stage.locator(".fo-state-detail")).toHaveCount(0);
      await expect(
        stage.getByRole("button", { name: "Reload", exact: true }),
      ).toHaveCount(1);
      await expect(stage.locator("[data-testid^='firna-button-']")).toHaveCount(
        1,
      );
      await expect(stage.locator("details[open]")).toHaveCount(0);
      await stage.locator("summary").click();
      await expect(stage.locator("details")).toContainText(
        "catalogue version 8",
      );
      await expect(stage).not.toContainText("Reference");
      expect(await page.evaluate(viewerDocumentViolations)).toEqual([]);
    });
