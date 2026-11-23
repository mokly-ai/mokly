/**
 * Decision 6 of the shell views plan: a Canvas artboard that draws an enabled
 * Highlight components switch draws the depicted view's highlight once a
 * reader checks it, without a script, inside Browse's sandboxed frames: the
 * shipped mask, in the shipped scrim, with a cutout over each instance that
 * the real screen owns, on every frame. These stages stand at 38%, below the
 * zoom at which the frames draw the shell's labels.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { unexpectedDesignScripts } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { canvasFrame } from "./workspace_actions.js";

/** The shipped scrim of the highlight mask, which the shipped theme declares. */
const SCRIM = "rgba(244, 246, 244, 0.72)";

/** The depicted instances, as the record's regions order them. */
const INSTANCES = [".mbk-shot-own-action", ".mbk-shot-toolbar"];

/**
 * The viewer's desktop frame lays an artboard out at the frame's own width.
 * Below 900px a Canvas root takes its compact form, which closes the panel
 * that holds the switch, so the page gives the frame the full layout.
 */
const WIDE_PAGE = { width: 1920, height: 1000 };

test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, baseURL!);
});

for (const path of ["design/canvas/overview", "design/canvas/outcomes/added"])
  test(`${path}: the checked Highlight components switch shows the mask of the screen's instances without labels below 60%`, async ({
    page,
  }) => {
    await page.setViewportSize(WIDE_PAGE);
    await page.goto(`/view/${path}/`);
    // The artboard's Desktop · Light frame on the canvas.
    const frame = page.frameLocator(canvasFrame("desktop"));
    const toggle = frame.getByRole("switch", { name: "Highlight components" });
    // The stage's frames: each viewport in both schemes.
    const views = frame.locator(".cv-frame[data-cv-frame]:visible");
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await expect(views).toHaveCount(4);
    await expect(views.locator(".mbk-highlight-mask:visible")).toHaveCount(0);

    await toggle.check();
    await expect(views.locator(".mbk-highlight-mask:visible")).toHaveCount(4);
    for (const view of await views.all()) {
      await expect(view.locator(".mbk-highlight-label:visible")).toHaveCount(0);
      const geometry = await view.evaluate((node, selectors) => {
        const cutouts = [
          ...node.querySelectorAll<SVGGraphicsElement>(".mbk-highlight-cutout"),
        ];
        return {
          scrim: getComputedStyle(node.querySelector(".mbk-highlight-scrim")!)
            .fill,
          boxes: selectors.map((selector, index) => {
            // The stage zooms each frame, so the cutout maps through its
            // screen matrix, which includes the zoom.
            const box = cutouts[index]!.getBBox();
            const matrix = cutouts[index]!.getScreenCTM()!;
            const start = new DOMPoint(box.x, box.y).matrixTransform(matrix);
            const end = new DOMPoint(
              box.x + box.width,
              box.y + box.height,
            ).matrixTransform(matrix);
            const bounds = node
              .querySelector(selector)!
              .getBoundingClientRect();
            return [
              start.x - bounds.x,
              start.y - bounds.y,
              end.x - start.x - bounds.width,
              end.y - start.y - bounds.height,
            ];
          }),
        };
      }, INSTANCES);
      expect(geometry.scrim).toBe(SCRIM);
      for (const box of geometry.boxes)
        for (const delta of box) expect(delta).toBeCloseTo(0, 0);
    }

    await toggle.uncheck();
    await expect(views.locator(".mbk-highlight-mask:visible")).toHaveCount(0);
    await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
  });
