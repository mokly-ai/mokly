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
      await page.goto(componentDesignUrl("overview", viewport));
      await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
      await expect(page.locator(".phone-frame, .browser-frame")).toHaveCount(0);
      await page.getByRole("link", { name: "Disabled", exact: true }).click();
      await expect(page).toHaveURL(
        componentDesignUrl("pages/variants", viewport),
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
        componentDesignUrl("inspection/details", viewport),
      );
      await expect(page.locator(".mbk-screen-head h2")).toHaveText("Welcome");
      await expect(
        page.getByRole("region", { name: "Selected instance" }),
      ).toContainText("Footer action");
    });

    test("view and comparison controls expose keyboard focus and selected state", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("overview", viewport));
      const selectedView = page.getByRole("combobox", {
        name: "Preview viewport",
      });
      await selectedView.focus();
      await expect(selectedView).toBeFocused();
      await expect(selectedView).toHaveValue(viewport);
      await expect(page.getByRole("switch", { name: "Dark mode" })).toHaveCount(
        0,
      );
      await page.goto(componentDesignUrl("pages/affected", viewport));
      await expect(
        page
          .getByRole("group", { name: "Comparison mode" })
          .getByRole("button", { name: "Current", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    test("component-only and independent screen changes have different membership and counts", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("pages/affected", viewport));
      const count =
        viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
      await expect(page.locator(count)).toHaveText("1");
      await expect(
        page
          .getByRole("region", { name: "Affected screens", exact: true })
          .getByRole("link"),
      ).toHaveCount(2);
      if (viewport === "desktop") {
        await expect(page.locator(".mbk-nav-scroll a")).toHaveCount(1);
        await expect(page.locator(".mbk-nav-scroll a")).toHaveText("Action");
      }
      await page.goto(componentDesignUrl("inspection/direct-change", viewport));
      await expect(page.locator(count)).toHaveText("2");
      await expect(
        page.locator(".ce-selected-instance .ce-props"),
      ).toContainText("Get started");
      if (viewport === "desktop")
        await expect(page.locator(".mbk-nav-scroll a")).toHaveText([
          "Welcome",
          "Action",
        ]);
    });

    test("mask cutouts match real component bounds without dimming their ancestors", async ({
      page,
    }) => {
      for (const [route, matches] of [
        [
          "highlight",
          [
            [".ce-toolbar-cutout", ".ce-demo-toolbar"],
            ["mask rect[y='258']", ".ce-demo-footer .ce-action"],
          ],
        ],
        ["nested", [[".ce-nested-cutout", ".ce-demo-toolbar .ce-action"]]],
      ] as const) {
        await page.goto(componentDesignUrl(`inspection/${route}`, viewport));
        await expect(
          page.getByRole("switch", { name: "Highlight components" }),
        ).toBeChecked();
        for (const [mask, component] of matches) {
          const geometry = await page.evaluate(
            ({ mask, component, viewport }) => {
              const preview = document.querySelector(
                `[data-preview-viewport="${viewport}"]`,
              )!;
              const shape = preview.querySelector<SVGGraphicsElement>(mask)!;
              const cutout = shape.getBBox();
              const origin = shape.ownerSVGElement!.getBoundingClientRect();
              const bounds = preview
                .querySelector(component)!
                .getBoundingClientRect();
              const ancestors: string[] = [];
              let element: Element | null = preview.querySelector(component);
              while (element) {
                ancestors.push(getComputedStyle(element).opacity);
                element = element.parentElement;
              }
              return {
                cutout: [
                  origin.x + cutout.x,
                  origin.y + cutout.y,
                  cutout.width,
                  cutout.height,
                ],
                bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
                ancestors,
              };
            },
            { mask, component, viewport },
          );
          geometry.bounds.forEach((value, index) =>
            expect(geometry.cutout[index]).toBeCloseTo(value, 0),
          );
          expect(geometry.ancestors.every((opacity) => opacity === "1")).toBe(
            true,
          );
        }
        if (route === "nested") {
          await expect(
            page.locator(".ce-instance-tree details").first(),
          ).toHaveAttribute("open", "");
          await expect(
            page.getByRole("region", { name: "Selected instance" }),
          ).toContainText("Toolbar action");
          await expect(page.locator(".ce-region:visible")).toHaveCount(1);
        } else await expect(page.locator(".ce-region:visible")).toHaveCount(2);
      }
    });

    test("missing metadata, empty usage, invisible instances, and removed sides stay distinct", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("states/empty", viewport));
      await expect(
        page.getByText("No registered components are used in this view."),
      ).toBeVisible();
      await page.goto(componentDesignUrl("states/unavailable", viewport));
      await expect(
        page.getByText("Component inspection is unavailable for this screen."),
      ).toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeDisabled();
      await page.goto(componentDesignUrl("inspection/details", viewport));
      await page
        .getByRole("button", { name: "Components", exact: true })
        .click();
      await page
        .locator(".ce-instance-tree summary")
        .filter({ hasText: "Help hint" })
        .click();
      await expect(
        page.getByText("No visible region", { exact: true }),
      ).toBeVisible();
      await page.goto(componentDesignUrl("states/unused", viewport));
      await expect(
        page.getByText("No screens or components use Badge yet."),
      ).toBeVisible();
      await page.goto(componentDesignUrl("states/removed", viewport));
      await expect(
        page
          .locator(".ce-preview-view:visible")
          .getByText("This variant has been removed.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("region", { name: "Affected screens", exact: true })
        .getByRole("link", { name: "Farewell" })
        .click();
      await expect(page).toHaveURL(
        componentDesignUrl("states/removed-consumer", viewport),
      );
      await expect(
        page
          .locator(".ce-preview-view:visible")
          .getByText("This screen was removed", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator(".ce-preview-view:visible")
          .getByText("There is no current preview to show.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-pane-missing")).toHaveCount(0);
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeDisabled();
    });
  });
}
