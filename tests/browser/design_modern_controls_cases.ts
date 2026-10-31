import path from "node:path";

import { expect } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { designModernControlGroups } from "./design_modern_controls_groups.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

export function registerDesignModernControls(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  test.beforeEach(({ allowBrowserError, baseURL }) =>
    documentFavicon(allowBrowserError, baseURL!),
  );
  const generated = path.join(repositoryRoot, "examples/basic/mokly-generated");
  const fileUrl = (file: string) =>
    designFileUrl(path.join(generated, file)).href;
  const withoutInspector = new Set([
    "design/browse/views/home",
    "design/browse/states/missing-route",
    "design/browse/states/navigation",
    "design/browse/views/use-case",
  ]);

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} unified design workspace`, () => {
      test.use({
        javaScriptEnabled: false,
        viewport:
          viewport === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
      });

      for (const group of designModernControlGroups) {
        test.describe(group.name, () => {
          test("every selected screen uses one icon footer and one view toolbar", async ({
            page,
          }) => {
            for (const screen of group.screens) {
              await page.goto(fileUrl(`${screen.path}/index.${viewport}.html`));
              await expect(page.locator(".mbk-details-bar")).toHaveCount(0);
              await expect(
                page.getByRole("group", {
                  name: /^(Viewport|Preview color scheme)$/,
                }),
              ).toHaveCount(0);
              if (withoutInspector.has(screen.path)) continue;
              await expect(
                page.locator(".mbk-inspector"),
                screen.path,
              ).toHaveCount(1);
              await expect(
                page.getByRole("group", { name: "View options" }),
                screen.path,
              ).toHaveCount(1);
              await expect(
                page.locator(".mbk-topbar .mbk-view-tools"),
              ).toHaveCount(0);
              for (const selection of ["mobile", "desktop", "both"]) {
                await page
                  .getByLabel("Viewport", { exact: true })
                  .selectOption(selection);
                await expect(
                  page.locator(".ce-preview-view:visible"),
                  screen.path,
                ).toHaveCount(selection === "both" ? 2 : 1);
              }
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
                screen.path,
              ).toBeLessThanOrEqual(viewport === "mobile" ? 390 : 1440);
            }
          });
        });
      }

      test("Browse viewport selection and footer opening stay inside the fixed shell", async ({
        page,
      }) => {
        await page.goto(
          fileUrl(`design/browse/views/screen/index.${viewport}.html`),
        );
        const header = page.locator(".mbk-screen-head");
        const initialHeader = await header.boundingBox();
        const options = page.getByLabel("Viewport", { exact: true });
        for (const selection of ["mobile", "desktop", "both"]) {
          await options.selectOption(selection);
          await expect(page.locator(".ce-preview-view:visible")).toHaveCount(
            selection === "both" ? 2 : 1,
          );
        }
        const details = page.locator(
          '.mbk-inspector details[data-inspector-tab="details"]',
        );
        await details
          .getByRole("button", { name: "Details", exact: true })
          .click();
        await expect(details).toHaveAttribute("open", "");
        await expect(details.locator(".mbk-inspector-content")).toHaveCSS(
          "overflow-y",
          "auto",
        );
        await expect(
          details.getByText("Why this screen —", { exact: false }),
        ).toBeVisible();
        if (viewport === "mobile") {
          const dock = page.locator(".ce-inspector-dock");
          const compact = await dock.boundingBox();
          await page
            .getByRole("switch", { name: "Expanded inspector", exact: true })
            .check();
          expect((await dock.boundingBox())!.height).toBeGreaterThan(
            compact!.height,
          );
        }
        await details.locator("[data-inspector-close]").click();
        await expect(details).not.toHaveAttribute("open", "");
        await expect(
          page.locator(".mbk-inspector > details[open]"),
        ).toHaveCount(0);
        expect((await header.boundingBox())!.y).toBe(initialHeader!.y);
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBeLessThanOrEqual(viewport === "mobile" ? 844 : 1000);
      });
    });
  }

  test("Both keeps full-size phone and desktop previews from overlapping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fileUrl("design/browse/views/screen/index.desktop.html"));
    const phone = (await page.locator(".phone-frame").boundingBox())!;
    const desktop = (await page.locator(".browser-frame").boundingBox())!;
    expect(
      phone.x + phone.width <= desktop.x || phone.y + phone.height <= desktop.y,
    ).toBe(true);
  });

  test("Browse footer resizes through its centered divider", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fileUrl("design/browse/views/screen/index.desktop.html"));
    await page.getByRole("button", { name: "Details", exact: true }).click();
    const panel = page.locator(".mbk-inspector");
    const before = (await panel.boundingBox())!;
    const grip = (await page.locator(".mbk-inspector-resize").boundingBox())!;
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 70, { steps: 10 });
    await page.mouse.up();
    expect((await panel.boundingBox())!.height).toBeGreaterThan(
      before.height + 50,
    );
  });
}
