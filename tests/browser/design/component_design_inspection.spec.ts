import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

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
          designArtboardUrl(
            `design/components/inspection/inspection-${route}`,
            viewport,
          ),
        );
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
          await expect(page.locator(".ce-region:visible")).toHaveCount(1);
        } else await expect(page.locator(".ce-region:visible")).toHaveCount(2);
      }
    });
    test("an invisible instance explains its region after its disclosure opens", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
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
    });

    test("Both previews show and hide their highlight layers with the native switch", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
          "design/components/inspection/inspection-details",
          viewport,
        ),
      );
      const toolbar = page.getByRole("toolbar", { name: "Preview options" });
      await toolbar
        .getByRole("combobox", { name: "Preview viewport" })
        .selectOption("both");
      const toggle = toolbar.getByRole("switch", {
        name: "Highlight components",
      });
      await toggle.check();
      await expect(
        page.locator(".ce-preview-view:visible .ce-highlight-layer:visible"),
      ).toHaveCount(2);
      await toggle.uncheck();
      await expect(page.locator(".ce-highlight-layer:visible")).toHaveCount(0);
    });

    test("a selected hidden instance shows its missing-region description", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
          "design/components/inspection/selection/inspection-help",
          viewport,
        ),
      );
      await expect(
        page
          .getByRole("region", { name: "Selected instance" })
          .getByText("No visible region", { exact: true }),
      ).toBeVisible();
    });

    test("empty, unavailable, unused, and removed states show their own content", async ({
      page,
    }) => {
      for (const [route, copy] of [
        ["empty", "No registered components are used in this view."],
        ["unavailable", "Component inspection is unavailable for this screen."],
        ["unused", "No screens or components use Badge yet."],
      ]) {
        await page.goto(
          designArtboardUrl(`design/components/states/${route}`, viewport),
        );
        await expect(page.getByText(copy!, { exact: true })).toBeVisible();
      }
      await page.goto(
        designArtboardUrl("design/components/states/removed", viewport),
      );
      await expect(
        page
          .locator(".ce-preview-view:visible")
          .getByText("This variant has been removed.", { exact: true }),
      ).toBeVisible();
      await page.goto(
        designArtboardUrl(
          "design/components/states/removed-consumer",
          viewport,
        ),
      );
      const preview = page.locator(".ce-preview-view:visible");
      await expect(
        preview.getByText("Come back whenever you are ready.", { exact: true }),
      ).toBeVisible();
      await expect(preview.locator(".ce-action--before")).toBeVisible();
      await expect(
        preview.locator(
          viewport === "desktop" ? ".browser-frame" : ".phone-frame",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Details", exact: true }),
      ).toBeVisible();
    });
  });
}
