import { expect, type Page } from "@playwright/test";

import type { test as baseTest } from "./browser_test.js";

/** The document of a design entry in one viewport, in the delivery under test. */
type DesignDocument = (entryPath: string, viewport: string) => string;

/** A frame of a Canvas stage, by its id. */
const stageFrame = (page: Page, id: string) =>
  page.locator(`.cv-frame[data-cv-frame="${id}"]`);

/** A toggle of the Frames filter, by the frames that it shows. */
const framesToggle = (page: Page, frames: string) =>
  page.locator(`[data-cv-frames="${frames}"]`);

/**
 * The Canvas artboards' native controls and measurements: the Frames filter
 * hides the frames that it turns off, also the frame that the compact frame
 * picker shows, and keeps one row per scheme; a selection's box model and
 * padding redline follow the selected element's own box.
 */
export function registerCanvasCases(
  test: typeof baseTest,
  design: DesignDocument,
) {
  test("mobile: the Frames filter hides the picked Canvas frame that it turns off", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [entry, picked, toggles] of [
      ["design/canvas/inspect/props", "mobile-light", ["light", "mobile"]],
      [
        "design/canvas/stage/component-set/disabled",
        "disabled-light",
        ["light"],
      ],
    ] as const)
      for (const toggle of toggles) {
        await page.goto(design(entry, "mobile"));
        await expect(stageFrame(page, picked)).toBeVisible();
        await framesToggle(page, toggle).uncheck();
        await expect(
          stageFrame(page, picked),
          `${entry} with ${toggle} turned off`,
        ).toBeHidden();
      }
  });

  test("desktop: the Frames filter keeps one row per scheme without a viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(design("design/canvas/overview", "desktop"));
    await framesToggle(page, "mobile").uncheck();
    await expect(stageFrame(page, "mobile-light")).toBeHidden();
    const light = (await stageFrame(page, "desktop-light").boundingBox())!;
    const dark = (await stageFrame(page, "desktop-dark").boundingBox())!;
    expect(dark.y).toBeGreaterThan(light.y + light.height);
    expect(dark.x).toBeCloseTo(light.x, 0);
  });

  test("desktop: a Canvas selection's box model and redline follow the selected element's box", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [entry, selector] of [
      ["design/canvas/inspect/selection", ".mbk-shot-own-action"],
      ["design/canvas/inspect/selection/toolbar", ".mbk-shot-toolbar"],
    ] as const) {
      await page.goto(design(entry, "desktop"));
      const element = await stageFrame(page, "mobile-light")
        .locator(selector)
        .evaluate((node) => {
          const style = getComputedStyle(node);
          const px = (value: string) => parseFloat(value);
          const left = node.getBoundingClientRect().left;
          return {
            content: `${node.clientWidth - px(style.paddingLeft) - px(style.paddingRight)} × ${node.clientHeight - px(style.paddingTop) - px(style.paddingBottom)}`,
            borderEdge: left + px(style.borderLeftWidth),
            contentEdge:
              left + px(style.borderLeftWidth) + px(style.paddingLeft),
          };
        });
      await expect(page.locator(".cv-boxm-content"), entry).toHaveText(
        element.content,
      );
      const redline = (await page.locator(".cv-sel-pad").boundingBox())!;
      expect(redline.x, entry).toBeCloseTo(element.borderEdge, 0);
      expect(redline.x + redline.width, entry).toBeCloseTo(
        element.contentEdge,
        0,
      );
    }
  });
}
