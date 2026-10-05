import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  componentDesignRoutes,
  componentDesignUrl,
} from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} component designs`, () => {
    test.use({
      viewport:
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
    });
    test("every owning artboard renders, links to real pages, and fits its width", async ({
      page,
    }, testInfo) => {
      for (const route of componentDesignRoutes) {
        await page.goto(componentDesignUrl(route, viewport));
        await expect(
          page.locator(`.ce-design .mbk-shell--${viewport}`),
        ).toHaveCount(1);
        await expect(page.locator(".mbk-screen-head h2")).toBeVisible();
        for (const panel of await page
          .locator(".ce-workspace details[open] > .ce-inspector-panel")
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
          expect(href).toMatch(/^file:/);
          await access(fileURLToPath(href));
        }
        await page.screenshot({
          path: testInfo.outputPath(`${route.replaceAll("/", "-")}.png`),
          fullPage: true,
        });
      }
    });
    test("saved variants share a page pattern and consuming-screen links work by keyboard", async ({
      page,
    }) => {
      await page.goto(
        componentDesignUrl("design/components/overview", viewport),
      );
      await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
      await expect(page.locator(".phone-frame, .browser-frame")).toHaveCount(0);
      await page
        .getByRole("navigation", { name: "Saved variants" })
        .getByRole("link", { name: "Disabled", exact: true })
        .click();
      await expect(page).toHaveURL(
        componentDesignUrl("design/components/pages/variants", viewport),
      );
      const preview = page.getByRole("region", {
        name: `${viewport === "desktop" ? "Desktop" : "Mobile"} component preview`,
        exact: true,
      });
      await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
      await expect(
        preview.getByRole("button", { name: "Continue" }),
      ).toBeDisabled();
      await expect(page.getByLabel("Supplied props")).toContainText("true");
      await page.getByRole("button", { name: "Usage", exact: true }).click();
      const welcome = page
        .getByRole("region", { name: "Used by", exact: true })
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
        name: "Preview viewport",
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
        page
          .getByRole("region", { name: "Affected screens", exact: true })
          .getByRole("link"),
      ).toHaveCount(2);
      if (viewport === "desktop") {
        await expect(page.locator(".mbk-nav-scroll a")).toContainText([
          "Action",
          "Default",
        ]);
        await expect(
          page.locator(".mbk-nav-scroll .mbk-nav-changed"),
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
        page.locator(".ce-selected-instance .ce-props"),
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
