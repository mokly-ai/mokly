import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} component workspace`, () => {
    test.use({
      viewport:
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });

    test("grouped view controls change the previews and retain edited fields", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
          "design/components/controls/editing/edited",
          viewport,
        ),
      );
      const toolbar = page.getByRole("toolbar", { name: "Preview options" });
      const mode = toolbar.getByRole("combobox", { name: "Preview viewport" });
      const label = page.getByRole("textbox", { name: "label", exact: true });
      await label.fill("Keep this edit");
      for (const selected of ["mobile", "desktop", "both"] as const) {
        await mode.selectOption(selected);
        await expect(page.locator(".ce-preview-view:visible")).toHaveCount(
          selected === "both" ? 2 : 1,
        );
        if (selected !== "both")
          await expect(
            page.locator(".ce-preview-view:visible"),
          ).toHaveAttribute("data-preview-viewport", selected);
        await expect(label).toHaveValue("Keep this edit");
      }
      await expect(page.locator(".ce-canvas:visible").first()).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
    });

    test("empty and comparison states keep their controls visible", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl("design/components/states/empty", viewport),
      );
      await expect(
        page
          .getByRole("region", { name: "Inspector", exact: true })
          .getByRole("button", { name: "Components", exact: true }),
      ).toBeVisible();
      await page.goto(
        designArtboardUrl(
          "design/components/controls/states/comparison",
          viewport,
        ),
      );
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toBeVisible();
    });

    test("single-component highlighting fills the screen and remains selectable", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
          "design/components/inspection/inspection-consumer",
          viewport,
        ),
      );
      await page.getByRole("switch", { name: "Highlight components" }).check();
      const preview = page.locator(".ce-preview-view:visible");
      const content = await preview.locator(".ce-other-example").boundingBox();
      const frame = await preview
        .locator(viewport === "mobile" ? ".phone-screen" : ".browser-viewport")
        .boundingBox();
      expect(content!.y + content!.height).toBeCloseTo(
        frame!.y + frame!.height,
        0,
      );
      await preview
        .getByRole("link", { name: "Inspect Action, Continue" })
        .click({ timeout: 3000 });
    });

    test("inspector resizing and scrolling keep the shell and tabs in place", async ({
      page,
    }) => {
      await page.goto(
        designArtboardUrl(
          "design/components/controls/editing/edited",
          viewport,
        ),
      );
      const inspector = page.locator(".ce-inspector");
      const heading = await page.locator(".mbk-screen-head").boundingBox();
      if (viewport === "desktop") {
        const grip = (await page
          .locator(".ce-inspector-resize")
          .boundingBox())!;
        const x = grip.x + grip.width / 2;
        const y = grip.y + grip.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y - 60, { steps: 12 });
        await page.mouse.up();
      } else {
        await page.getByRole("switch", { name: "Expanded inspector" }).check();
      }
      const tabs = await inspector
        .locator("details[open] > summary")
        .boundingBox();
      await inspector
        .locator("details[open] .ce-inspector-panel")
        .evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
      await expect(
        page.getByRole("textbox", { name: "hint", exact: true }),
      ).toBeInViewport();
      expect(
        await inspector.locator("details[open] > summary").boundingBox(),
      ).toEqual(tabs);
      expect(await page.locator(".mbk-screen-head").boundingBox()).toEqual(
        heading,
      );
      const scroll = await page.evaluate(() => ({
        document: document.documentElement.scrollHeight - innerHeight,
        main: document.querySelector(".mbk-main")!.scrollTop,
      }));
      expect(scroll.document).toBeLessThanOrEqual(1);
      expect(scroll.main).toBe(0);
      await expect(page.locator(".mbk-screen-head h2")).toBeInViewport();
    });
  });
}
