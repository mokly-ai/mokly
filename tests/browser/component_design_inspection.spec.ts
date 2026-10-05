import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} component designs`, () => {
    test.use({
      viewport:
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
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
        await page.goto(
          componentDesignUrl(
            `design/components/inspection/inspection-${route}`,
            viewport,
          ),
        );
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
    test("missing metadata, empty usage, invisible instances, and removed states stay distinct", async ({
      page,
    }) => {
      await page.goto(
        componentDesignUrl("design/components/states/empty", viewport),
      );
      await expect(
        page.getByText("No registered components are used in this view."),
      ).toBeVisible();
      await page.goto(
        componentDesignUrl("design/components/states/unavailable", viewport),
      );
      await expect(
        page.getByText("Component inspection is unavailable for this screen."),
      ).toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeDisabled();
      await page.goto(
        componentDesignUrl(
          "design/components/inspection/inspection-details",
          viewport,
        ),
      );
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
      await page.goto(
        componentDesignUrl("design/components/states/unused", viewport),
      );
      await expect(
        page.getByText("No screens or components use Badge yet."),
      ).toBeVisible();
      await page.goto(
        componentDesignUrl("design/components/states/removed", viewport),
      );
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
        componentDesignUrl(
          "design/components/states/removed-consumer",
          viewport,
        ),
      );
      await expect(page.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await expect(
        page
          .locator(".ce-preview-view:visible")
          .getByText("Come back whenever you are ready.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".ce-preview-view:visible .ce-action--before"),
      ).toBeVisible();
      await expect(page.locator(".ce-preview-set")).toHaveAttribute(
        "data-viewport",
        viewport,
      );
      await expect(
        page.locator(
          viewport === "desktop"
            ? ".ce-preview-view:visible .browser-frame"
            : ".ce-preview-view:visible .phone-frame",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-pane-missing")).toHaveCount(0);
      await expect(page.getByRole("switch", { name: "Dark mode" })).toHaveCount(
        0,
      );
      await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
        "light",
      );
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeDisabled();
      await expect(
        page
          .locator(viewport === "desktop" ? ".mbk-nav" : ".ce-mobile-location")
          .getByRole("link", {
            name: viewport === "desktop" ? "Action" : /Changes/,
          }),
      ).toHaveAttribute("data-mokly-link", "design/components/states/removed");
      await expect(
        page.getByRole("button", { name: "Details", exact: true }),
      ).toBeVisible();
    });
  });
}
