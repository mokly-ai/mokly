import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { unexpectedDesignScripts } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { canvasFrame } from "./workspace_actions.js";

type Viewport = "desktop" | "mobile";

/** One fold of a Canvas artboard's Inspect panel. */
function fold(page: Page, section: string) {
  return page.locator(`[data-cv-section="${section}"]`);
}

/**
 * A leaf component and a component with nested components, each where its
 * artboard draws the panel: a phone draws it only in an open panel sheet,
 * and no phone artboard opens the Toolbar's.
 */
const COMPONENTS: Record<Viewport, { leaf: string; nested: string[] }> = {
  desktop: {
    leaf: "design/canvas/stage/component-set",
    nested: ["design/canvas/stage/component-set/toolbar"],
  },
  mobile: { leaf: "design/canvas/stage/component-set/disabled", nested: [] },
};

/** Unchanged entries, also with temporary edits, which offer no comparison. */
const UNCHANGED = [
  "design/canvas/inspect/unchanged",
  "design/canvas/stage/component-set",
  "design/canvas/props/editing/edited",
  "design/canvas/props/editing/unset",
];

/** Run the same assertions against each catalogue delivery. */
export function registerComponentWorkspace() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture();

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
        const { leaf, nested } = COMPONENTS[viewport];
        await page.goto(designDocumentUrl(leaf, viewport));
        await expect(fold(page, "props"), leaf).toHaveCount(1);
        await expect(fold(page, "nested"), leaf).toHaveCount(0);
        for (const route of nested) {
          await page.goto(designDocumentUrl(route, viewport));
          await fold(page, "nested").locator(":scope > summary").click();
          await expect(fold(page, "nested"), route).toContainText("Action");
        }
        // A screen without registered components keeps its Components fold.
        await page.goto(
          designDocumentUrl("design/canvas/inspect/unchanged", viewport),
        );
        await expect(
          fold(page, "components").locator(":scope > summary"),
        ).toBeVisible();
        await expect(
          fold(page, "components").locator(".cv-sec-count"),
        ).toHaveText("0");
      });

      test("a Frames filter change keeps edited fields", async ({ page }) => {
        await page.goto(
          designDocumentUrl(
            "design/canvas/stage/component-set/disabled",
            viewport,
          ),
        );
        const label = fold(page, "props").getByRole("textbox", {
          name: "Label",
          exact: true,
        });
        const light = page.locator('[data-cv-frames="light"]');
        const frame = page.locator('.cv-frame[data-cv-frame="disabled-light"]');
        await label.fill("Keep this edit");
        await light.uncheck();
        await expect(frame).toBeHidden();
        await expect(label).toHaveValue("Keep this edit");
        await light.check();
        await expect(frame).toBeVisible();
        await expect(label).toHaveValue("Keep this edit");
      });

      test("unchanged examples omit comparison modes including temporary edits", async ({
        page,
      }) => {
        const modes = page.getByRole("list", { name: "Comparison mode" });
        for (const route of UNCHANGED) {
          await page.goto(designDocumentUrl(route, viewport));
          await expect(page.locator(".cv-root"), route).toHaveCount(1);
          // An unchanged entry has no Changes tab and no status.
          await expect(
            page.locator('.cv-ptab[data-tab="changes"]'),
            route,
          ).toHaveCount(0);
          await expect(modes, route).toHaveCount(0);
          await expect(page.locator(".mbk-entry-status"), route).toHaveCount(0);
        }
        await page.goto(
          designDocumentUrl(
            "design/canvas/components/compare/current",
            viewport,
          ),
        );
        await expect(modes).toBeVisible();
        await expect(
          page.locator(".cv-canvas .mbk-entry-status:visible"),
        ).toHaveText("Changed");
      });

      test("only the panel body scrolls, and the tabs and the stage stay in place", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl("design/canvas/inspect/sections", viewport),
        );
        const panel = page.getByRole("region", { name: "Panel", exact: true });
        const tabs = panel.locator(".cv-ptabs");
        const stage = page.locator(".cv-canvas");
        const body = panel.locator(".cv-float-body");
        const last = fold(page, "components");
        // Arrange the panel at its top, where its last fold is out of view.
        await body.evaluate((node) => {
          node.scrollTop = 0;
        });
        const before = {
          tabs: await tabs.boundingBox(),
          stage: await stage.boundingBox(),
        };
        await expect(last).not.toBeInViewport();
        await body.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await expect(last).toBeInViewport();
        expect(await tabs.boundingBox()).toEqual(before.tabs);
        expect(await stage.boundingBox()).toEqual(before.stage);
        const scroll = await page.evaluate(() => ({
          document: document.documentElement.scrollHeight - innerHeight,
          main: document.querySelector(".mbk-main")!.scrollTop,
        }));
        expect(scroll.document).toBeLessThanOrEqual(1);
        expect(scroll.main).toBe(0);
      });
    });
  }

  test("view controls, folds, and highlighting work inside sandboxed Browse frames", async ({
    page,
  }) => {
    // The viewer's desktop frame lays the artboard out at the frame's own
    // width. Below 900px a Canvas root takes its compact form, which closes
    // the panel, so the page gives the frame the full layout.
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/view/design/canvas/overview/");
    // The design screen's Desktop · Light frame on the canvas.
    const frame = page.frameLocator(canvasFrame("desktop"));
    // The Frames filter hides the frames that it turns off.
    const light = frame.locator('[data-cv-frames="light"]');
    const desktop = frame.locator('.cv-frame[data-cv-frame="desktop-light"]');
    await light.uncheck();
    await expect(desktop).toBeHidden();
    await light.check();
    await expect(desktop).toBeVisible();
    // Highlight components masks every frame, and each mask id is unique.
    const toggle = frame.getByRole("switch", { name: "Highlight components" });
    await toggle.check();
    await expect(frame.locator(".mbk-highlight-mask:visible")).toHaveCount(4);
    const ids = await frame
      .locator("mask")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
    await toggle.uncheck();
    await expect(frame.locator(".mbk-highlight-mask:visible")).toHaveCount(0);
    // A native fold of Inspect opens and closes.
    const usage = frame.locator('[data-cv-section="usage"]');
    await usage.locator(":scope > summary").click();
    await expect(usage.locator('[data-usage-section="used-by"]')).toBeVisible();
    await usage.locator(":scope > summary").click();
    await expect(usage.locator('[data-usage-section="used-by"]')).toBeHidden();
    await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
  });
}
