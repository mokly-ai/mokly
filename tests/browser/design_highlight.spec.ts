/**
 * Decision 6 of the shell views plan: a Browse or Changes artboard that draws
 * an enabled Highlight components switch draws the depicted view's highlight
 * once a reader checks it, without a script, inside Browse's sandboxed
 * frames: the shipped mask, in the shipped scrim, with a cutout over each
 * instance that the real screen owns, and the shell's label of each.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { unexpectedDesignScripts } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

/** The shipped scrim of the highlight mask, which the shipped theme declares. */
const SCRIM = "rgba(244, 246, 244, 0.72)";

/** The depicted instances, as the record's regions order them. */
const INSTANCES = [".mbk-shot-own-action", ".mbk-shot-toolbar"];

test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, baseURL!);
});

for (const [path, labels] of [
  ["design/browse/views/screen", ["Action · details", "Toolbar · toolbar"]],
  ["design/changes/outcomes/added", ["Action · welcome", "Toolbar · toolbar"]],
] as const)
  test(`${path}: the checked Highlight components switch shows the mask and the labels of the screen's instances`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/view/${path}/`);
    const frame = page.frameLocator(".mbk-frame-desktop iframe");
    const toggle = frame.getByRole("switch", { name: "Highlight components" });
    const views = frame.locator(".ce-preview-view:visible");
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await expect(views.locator(".ce-highlight-layer:visible")).toHaveCount(0);

    await toggle.check();
    const count = await views.count();
    expect(count).toBeGreaterThan(0);
    await expect(views.locator(".mbk-highlight-mask:visible")).toHaveCount(
      count,
    );
    for (const view of await views.all()) {
      await expect(view.locator(".mbk-highlight-label")).toHaveText([
        ...labels,
      ]);
      const geometry = await view.evaluate((node, selectors) => {
        const cutouts = [
          ...node.querySelectorAll<SVGGraphicsElement>(".mbk-highlight-cutout"),
        ];
        return {
          scrim: getComputedStyle(node.querySelector(".mbk-highlight-scrim")!)
            .fill,
          boxes: selectors.map((selector, index) => {
            const cutout = cutouts[index]!.getBBox();
            const origin =
              cutouts[index]!.ownerSVGElement!.getBoundingClientRect();
            const bounds = node
              .querySelector(selector)!
              .getBoundingClientRect();
            return [
              origin.x + cutout.x - bounds.x,
              origin.y + cutout.y - bounds.y,
              cutout.width - bounds.width,
              cutout.height - bounds.height,
            ];
          }),
        };
      }, INSTANCES);
      expect(geometry.scrim).toBe(SCRIM);
      for (const box of geometry.boxes)
        for (const delta of box) expect(delta).toBeCloseTo(0, 0);
    }

    await toggle.uncheck();
    await expect(views.locator(".ce-highlight-layer:visible")).toHaveCount(0);
    await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
  });
