import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import {
  assertDesignResource,
  designResourceExists,
} from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentDesign(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { componentDesignRoutes, componentDesignUrl } = componentDesignFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} component designs`, () => {
      test.use({
        viewport:
          viewport === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
      });
      for (const route of componentDesignRoutes)
        test(`${route}: owning artboard renders, links to real pages, and fits its width`, async ({
          page,
        }, testInfo) => {
          await page.goto(componentDesignUrl(route, viewport));
          await expect(
            page.locator(`.ce-design .mbk-shell--${viewport}`),
          ).toHaveCount(1);
          await expect(page.locator(".mbk-screen-head h2")).toBeVisible();
          for (const panel of await page
            .locator(".mbk-workspace details[open] > .mbk-inspector-content")
            .all()) {
            await expect(
              panel,
              `${route} keeps bounded panel scrolling`,
            ).toHaveCSS("overflow-y", "auto");
          }
          await expect(
            page.getByRole("navigation", { name: "Related design pages" }),
          ).toHaveCount(0);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(overflow, `${route} has no document overflow`).toBe(false);
          const links = await page
            .locator("a[href]")
            .evaluateAll((elements) =>
              elements.map((element) => (element as HTMLAnchorElement).href),
            );
          for (const href of new Set(links)) {
            await assertDesignResource(href, page.url());
            expect(await designResourceExists(page.request, href), href).toBe(
              true,
            );
          }
          await page.screenshot({
            path: testInfo.outputPath(`${route.replaceAll("/", "-")}.png`),
            fullPage: true,
          });
        });
      test("saved variants share a page pattern and consuming-screen links work by keyboard", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl("design/components/overview", viewport),
        );
        await expect(page.locator(".mbk-component-canvas:visible")).toHaveCount(
          1,
        );
        await expect(page.locator(".phone-frame, .browser-frame")).toHaveCount(
          0,
        );
        await page
          .getByRole("navigation", { name: "Saved variants" })
          .getByRole("link", { name: "Disabled", exact: true })
          .click();
        await expect(page).toHaveURL(
          componentDesignUrl("design/components/pages/variants", viewport),
        );
        const preview = page.locator(
          `.mbk-component-canvas.mbk-frame-${viewport}`,
        );
        await expect(page.locator(".mbk-component-canvas:visible")).toHaveCount(
          1,
        );
        await expect(
          preview.getByRole("button", { name: "Continue" }),
        ).toBeDisabled();
        // The variant page edits the Disabled variant's own props in place.
        await expect(
          page
            .getByRole("region", { name: "Props", exact: true })
            .getByRole("checkbox", { name: "disabled", exact: true }),
        ).toBeChecked();
        await page.getByRole("button", { name: "Usage", exact: true }).click();
        const welcome = page
          .locator('[data-usage-section="used-by"]')
          .getByRole("link", { name: "Welcome" });
        await welcome.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(
          componentDesignUrl(
            "design/components/inspection/inspection-details",
            viewport,
          ),
        );
        await expect(page.locator(".mbk-screen-head h2")).toHaveText("Welcome");
        await expect(
          page.getByRole("region", { name: "Selected instance" }),
        ).toContainText("Footer action");
      });
      test("view and comparison controls expose keyboard focus and selected state", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl("design/components/overview", viewport),
        );
        const selectedView = page.getByRole("combobox", {
          name: "Viewport",
        });
        await selectedView.focus();
        await expect(selectedView).toBeFocused();
        await expect(selectedView).toHaveValue(viewport);
        await expect(
          page.getByRole("switch", { name: "Dark preview" }),
        ).toHaveCount(0);
        await page.goto(
          componentDesignUrl("design/components/pages/affected", viewport),
        );
        await expect(
          page
            .getByRole("group", { name: "Comparison mode" })
            .getByRole("button", { name: "Current", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      });
      test("component-only and independent screen changes have different membership and counts", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl("design/components/pages/affected", viewport),
        );
        const count =
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
        await expect(page.locator(count)).toHaveText("1");
        await expect(
          page.locator('[data-usage-section="affected"]').getByRole("link"),
        ).toHaveCount(2);
        if (viewport === "desktop") {
          await expect(page.locator(".mbk-nav-scroll a")).toContainText([
            "Action",
            "Default",
          ]);
          await expect(
            page.locator(
              '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
            ),
          ).toHaveCount(2);
        }
        await page.goto(
          componentDesignUrl(
            "design/components/inspection/inspection-direct-change",
            viewport,
          ),
        );
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
