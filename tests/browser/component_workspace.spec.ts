import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} component workspace`, () => {
    test.use({
      viewport:
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });

    test("component tabs distinguish leaves from nested components", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("controls/overview", viewport));
      const inspector = page.getByRole("region", {
        name: "Inspector",
        exact: true,
      });
      await expect(inspector.locator('[data-panel="components"]')).toHaveCount(
        0,
      );
      await page.goto(componentDesignUrl("pages/toolbar", viewport));
      await inspector
        .getByRole("button", { name: "Nested components", exact: true })
        .click();
      await expect(
        inspector.getByRole("region", {
          name: "Nested components",
          exact: true,
        }),
      ).toContainText("Action");
      await page.goto(componentDesignUrl("states/empty", viewport));
      await expect(
        inspector.getByRole("button", { name: "Components", exact: true }),
      ).toBeVisible();
    });

    test("grouped view controls change the previews and retain edited fields", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("controls/editing/edited", viewport));
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
      await toolbar.getByRole("switch", { name: "Dark mode" }).check();
      await expect(
        page.locator(".ce-canvas:visible .ce-scheme-dark"),
      ).toHaveCount(2);
      await expect(page.locator(".ce-canvas:visible").first()).toHaveCSS(
        "background-color",
        "rgb(30, 37, 33)",
      );
      await toolbar.getByRole("switch", { name: "Dark mode" }).uncheck();
      await expect(page.locator(".ce-canvas:visible").first()).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      await expect(
        page.locator(".mbk-topbar .mbk-seg, .ce-inspection-toolbar"),
      ).toHaveCount(0);
    });

    test("single-component highlighting fills the screen and remains selectable", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("inspection/consumer", viewport));
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
      await expect(page).toHaveURL(
        componentDesignUrl("inspection/consumer", viewport),
      );
      await expect(
        page.getByRole("region", { name: "Selected instance" }),
      ).toContainText("Continue");
    });

    test("unchanged examples omit comparison modes including temporary edits", async ({
      page,
    }) => {
      for (const route of [
        "overview",
        "controls/editing/unset",
        "states/empty",
      ]) {
        await page.goto(componentDesignUrl(route, viewport));
        await expect(
          page.getByRole("group", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(page.locator(".mbk-screen-head")).toContainText(
          "Unmodified",
        );
      }
      await page.goto(
        componentDesignUrl("controls/states/comparison", viewport),
      );
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toBeVisible();
      await expect(page.locator(".mbk-screen-head")).not.toContainText(
        "Unmodified",
      );
    });

    test("inspector resizing and scrolling keep the shell and tabs in place", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("controls/editing/edited", viewport));
      const pane = page.locator(".ce-preview-pane");
      const inspector = page.locator(".ce-inspector");
      const heading = await page.locator(".mbk-screen-head").boundingBox();
      const before = await inspector.boundingBox();
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
      await expect
        .poll(async () => (await inspector.boundingBox())!.height)
        .toBeGreaterThan(before!.height + 40);
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
      await inspector
        .getByRole("button", { name: "Controls", exact: true })
        .click();
      await expect(inspector).toHaveCSS("height", "49px");
      await expect(pane).toHaveCSS("resize", "none");
      await inspector
        .getByRole("button", { name: "Controls", exact: true })
        .click();
      await expect(page.locator(".mbk-screen-head h2")).toBeInViewport();
    });
  });
}

test("view controls and highlighting work inside sandboxed Browse frames", async ({
  page,
}) => {
  await page.goto("/view/design/components/inspection/details.html");
  const frame = page.frameLocator(".mbk-frame-desktop iframe");
  const toolbar = frame.getByRole("toolbar", { name: "Preview options" });
  await toolbar
    .getByRole("combobox", { name: "Preview viewport" })
    .selectOption("both");
  await toolbar.getByRole("switch", { name: "Highlight components" }).check();
  await expect(
    frame.locator(".ce-preview-view:visible .ce-highlight-layer:visible"),
  ).toHaveCount(2);
  const ids = await frame
    .locator("mask")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  await toolbar.getByRole("switch", { name: "Highlight components" }).uncheck();
  await expect(frame.locator(".ce-highlight-layer:visible")).toHaveCount(0);
  await expect(frame.locator("script")).toHaveCount(1);
  await expect(frame.locator("script")).toHaveAttribute(
    "src",
    "/__mokly/client/inspector.js",
  );
});
