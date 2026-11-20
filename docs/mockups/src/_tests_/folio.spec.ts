import { pathToFileURL } from "node:url";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { expect, test } from "@playwright/test";

import { screenFile } from "./catalogue-paths";
import { rgb } from "./color-metrics";
import { permanentScreens } from "./folio-inventory";

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const) {
    test(
      "Folio and Canvas preserve surfaces, geometry and frames: " +
        viewport +
        " " +
        scheme,
      async ({ page }) => {
        await page.setViewportSize({
          width: viewport === "mobile" ? 390 : 1440,
          height: viewport === "mobile" ? 844 : 900,
        });
        for (const { path: id, palette } of permanentScreens) {
          await page.goto(pathToFileURL(screenFile(id, viewport, scheme)).href);
          // The renderer's wrapper carries the palette and paints the page.
          const wrapper = page.locator("[data-color-scheme][data-viewport]");
          await expect(wrapper).toHaveClass(palette + "-scope");
          await expect(wrapper).toHaveCSS(
            "background-color",
            rgb(paletteColors(scheme, palette).background),
          );
          await expect(page.locator("main")).toBeVisible();
          await expect(page.locator("h1")).toHaveCount(1);
          const action = page.getByTestId("firna-button-primary").first();
          if (await action.count())
            await expect(action).toHaveCSS(
              "border-radius",
              paletteUiTheme(scheme, palette).radii.md + "px",
            );
          // The viewer's stage draws the publication's screen in its phone
          // and browser frames; no Folio screen frames a document.
          await expect(
            page.locator("[data-mokly-stage] [data-mkc-sample-screen]"),
          ).toHaveCount(id.startsWith("product/viewer/") ? 2 : 0);
          await expect(page.locator("iframe")).toHaveCount(0);
          if (id.startsWith("product/settings/")) {
            const frame = page.locator(
              viewport === "desktop" ? ".fo-dialog" : ".fo-layer",
            );
            await expect(frame).toBeVisible();
            const box = (await frame.boundingBox())!;
            if (viewport === "desktop") {
              expect(box.width).toBeLessThanOrEqual(960);
              expect(box.height).toBeLessThanOrEqual(900 * 0.9 + 1);
              await expect(
                page.getByRole("navigation", { name: "Settings sections" }),
              ).toBeVisible();
            } else {
              expect(box.width).toBe(390);
              await expect(page.locator(".fo-dialog")).toHaveCount(0);
            }
            const stage = page.locator(".fo-settings-backdrop");
            await expect(stage).toHaveCount(viewport === "desktop" ? 1 : 0);
            if (viewport === "desktop") {
              await expect(stage.locator(".fo-stage-canvas")).toBeVisible();
              await expect(stage.locator("main, h1, a, button")).toHaveCount(0);
              expect((await stage.innerText()).trim()).toBe("");
            }
          }
        }
      },
    );
  }
