import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import { unexpectedDesignScripts as servedScripts } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentWorkspace(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const unexpectedDesignScripts = () =>
    mode === "static"
      ? 'script:not([src="/mokly-viewer/client/inspector.js"])'
      : servedScripts();
  const { componentDesignUrl } = componentDesignFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

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
        await page.goto(
          componentDesignUrl("design/components/controls/controls", viewport),
        );
        const inspector = page.getByRole("region", {
          name: "Inspector",
          exact: true,
        });
        await expect(
          inspector.locator('[data-inspector-tab="components"]'),
        ).toHaveCount(0);
        await page.goto(
          componentDesignUrl("design/components/pages/toolbar", viewport),
        );
        await inspector
          .getByRole("button", { name: "Nested components", exact: true })
          .click();
        await expect(
          inspector.getByRole("region", {
            name: "Nested components",
            exact: true,
          }),
        ).toContainText("Action");
        await page.goto(
          componentDesignUrl("design/components/states/empty", viewport),
        );
        await expect(
          inspector.getByRole("button", { name: "Components", exact: true }),
        ).toBeVisible();
      });

      test("grouped view controls change the previews and retain edited fields", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl(
            "design/components/controls/editing/edited",
            viewport,
          ),
        );
        const toolbar = page.getByRole("group", { name: "View options" });
        const mode = toolbar.getByRole("combobox", {
          name: "Viewport",
        });
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
        await expect(
          toolbar.getByRole("switch", { name: "Dark preview" }),
        ).toHaveCount(0);
        await expect(
          page.locator(".mbk-component-canvas:visible .mbk-frame-label"),
        ).toHaveText(["Mobile", "Desktop"]);
        const documents = page.locator(
          ".mbk-component-canvas:visible .ce-canvas-content",
        );
        await expect(documents.first()).toHaveCSS(
          "background-color",
          "rgb(255, 255, 255)",
        );
        // The component stands where the shell's documents draw it: 24px from
        // the top left inside the canvas's border.
        expect(
          await documents.evaluateAll((boxes) =>
            boxes.map((box) => {
              const inner = box.getBoundingClientRect();
              const component = box.firstElementChild!.getBoundingClientRect();
              return [
                component.left - inner.left - box.clientLeft,
                component.top - inner.top - box.clientTop,
              ];
            }),
          ),
        ).toEqual([
          [24, 24],
          [24, 24],
        ]);
        await expect(
          page.locator(".mbk-topbar .mbk-seg, .ce-inspection-toolbar"),
        ).toHaveCount(0);
      });

      test("single-component highlighting fills the screen and remains selectable", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl(
            "design/components/inspection/inspection-consumer",
            viewport,
          ),
        );
        await page
          .getByRole("switch", { name: "Highlight components" })
          .check();
        const preview = page.locator(".ce-preview-view:visible");
        const content = await preview
          .locator(".ce-other-example")
          .boundingBox();
        const frame = await preview
          .locator(
            viewport === "mobile" ? ".phone-screen" : ".browser-viewport",
          )
          .boundingBox();
        expect(content!.y + content!.height).toBeCloseTo(
          frame!.y + frame!.height,
          0,
        );
        // The shipped label of the highlighted Action opens its selection.
        await preview
          .getByRole("link", { name: "Action · Continue" })
          .click({ timeout: 15_000 });
        await expect(page).toHaveURL(
          componentDesignUrl(
            "design/components/inspection/inspection-consumer",
            viewport,
          ),
        );
        await expect(
          page.getByRole("region", { name: "Selected instance" }),
        ).toContainText("Continue");
      });

      test("unchanged examples omit comparison modes including temporary edits", async ({
        page,
      }) => {
        for (const route of [
          "design/components/overview",
          "design/components/controls/editing/unset",
          "design/components/states/empty",
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
          componentDesignUrl(
            "design/components/controls/states/comparison",
            viewport,
          ),
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
        await page.goto(
          componentDesignUrl(
            "design/components/controls/editing/edited",
            viewport,
          ),
        );
        const pane = page.locator(".ce-preview-pane");
        const inspector = page.locator(".mbk-inspector");
        const heading = await page.locator(".mbk-screen-head").boundingBox();
        const before = await inspector.boundingBox();
        if (viewport === "desktop") {
          const grip = (await page
            .locator(".mbk-inspector-resize")
            .boundingBox())!;
          const x = grip.x + grip.width / 2;
          const y = grip.y + grip.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y - 60, { steps: 12 });
          await page.mouse.up();
        } else {
          await page
            .getByRole("switch", { name: "Expanded inspector" })
            .check();
        }
        await expect
          .poll(async () => (await inspector.boundingBox())!.height)
          .toBeGreaterThan(before!.height + 40);
        const tabs = await inspector
          .locator("details[open] > summary")
          .boundingBox();
        await inspector
          .locator("details[open] .mbk-inspector-content")
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
          .getByRole("button", { name: "Props", exact: true })
          .click();
        await expect(inspector).toHaveCSS("height", "46px");
        await expect(pane).toHaveCSS("resize", "none");
        await inspector
          .getByRole("button", { name: "Props", exact: true })
          .click();
        await expect(page.locator(".mbk-screen-head h2")).toBeInViewport();
      });
    });
  }

  test("view controls and highlighting work inside sandboxed Browse frames", async ({
    page,
  }) => {
    await page.goto("/view/design/components/inspection/inspection-details/");
    const frame = page.frameLocator(".mbk-frame-desktop iframe");
    const toolbar = frame.getByRole("group", { name: "View options" });
    await toolbar
      .getByRole("combobox", { name: "Viewport" })
      .selectOption("both");
    await toolbar.getByRole("switch", { name: "Highlight components" }).check();
    await expect(
      frame.locator(".ce-preview-view:visible .ce-highlight-layer:visible"),
    ).toHaveCount(2);
    const ids = await frame
      .locator("mask")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    await toolbar
      .getByRole("switch", { name: "Highlight components" })
      .uncheck();
    await expect(frame.locator(".ce-highlight-layer:visible")).toHaveCount(0);
    await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
  });
}
