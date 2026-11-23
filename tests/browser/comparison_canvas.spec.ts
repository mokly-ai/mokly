import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonFrames, modeButton } from "./comparison_ui.js";

/** Open an entry on a wide canvas and show one compare mode on its frames. */
async function openMode(
  page: Page,
  path: string,
  mode: "Overlay" | "Swipe",
): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`/view/${path}/`);
  await modeButton(page, mode).click();
  await expect(modeButton(page, mode)).toHaveAttribute("aria-pressed", "true");
  await expect(comparisonFrames(page).first()).toBeAttached();
}

/** Every grip of Swipe's dividers, one for each compared frame. */
function grips(page: Page): Locator {
  return page.getByRole("slider", { name: /^Divider, / });
}

async function expectGripsAt(page: Page, value: string): Promise<void> {
  for (const grip of await grips(page).all())
    await expect(grip).toHaveAttribute("aria-valuenow", value);
}

test("Swipe draws one divider at the same place on every frame, which a drag and the keys move", async ({
  page,
}) => {
  await openMode(page, comparisonPaths.changed, "Swipe");
  await expect(grips(page)).not.toHaveCount(0);
  expect(await grips(page).count()).toBeGreaterThan(1);
  await expectGripsAt(page, "50");

  const frame = page
    .locator("[data-mokly-stage] figure")
    .filter({ has: grips(page) })
    .first();
  const grip = frame.getByRole("slider", { name: /^Divider, / });
  const area = (await frame.boundingBox())!;
  const start = (await grip.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 4, start.y + start.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await expectGripsAt(page, "25");
  // The drag moved the divider, not the canvas.
  expect(await frame.boundingBox()).toEqual(area);

  await expect(grip).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expectGripsAt(page, "29");
  await page.keyboard.press("End");
  await expectGripsAt(page, "100");
  await page.keyboard.press("Home");
  await expectGripsAt(page, "0");
  // The current version shows only to the right of the divider.
  await expect(
    frame.locator("[data-compare-mode='swipe'] .mb-pane--after"),
  ).toHaveCSS("clip-path", "inset(0px 0px 0px 0%)");

  // The grip keeps its size at every zoom.
  const size = (await grip.boundingBox())!;
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect
    .poll(async () => {
      const box = (await grip.boundingBox())!;
      return [Math.round(box.width), Math.round(box.height)];
    })
    .toEqual([Math.round(size.width), Math.round(size.height)]);
});

test("a zoom gesture and a canvas key inside a pane reach the canvas", async ({
  page,
}) => {
  await openMode(page, comparisonPaths.changed, "Overlay");
  const zoom = page.getByRole("group", { name: "Zoom" });
  const fitted = await zoom.textContent();
  const current = page
    .locator(
      "[data-mokly-stage] [data-compare-mode='overlay'] .mb-pane--after iframe",
    )
    .first();
  await expect(current.contentFrame().locator("body")).not.toBeEmpty();
  const box = (await current.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -240);
  await page.keyboard.up("Control");
  await expect(zoom).not.toHaveText(fitted!);

  // Shift+1 inside the pane's document fits the canvas again.
  await current
    .contentFrame()
    .locator("body")
    .click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Shift+Digit1");
  await expect(zoom).toHaveText(fitted!);
});

test("a component frame in a compare takes the larger size of its two versions", async ({
  page,
}) => {
  await openMode(page, comparisonPaths.component, "Overlay");
  const frame = page
    .locator("[data-mokly-stage] figure")
    .filter({ has: page.locator("[data-compare-mode='overlay']") })
    .first();
  const panes = frame.locator("iframe[data-mokly-comparison-frame]");
  await expect(panes).toHaveCount(2);
  // Each version's own size: its content's box with the same margin on its
  // far edges as on its near edges.
  const measure = (pane: Locator) =>
    pane.evaluate((element: HTMLIFrameElement) => {
      const doc = element.contentDocument!;
      const boxes = [...doc.body.children]
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const left = Math.min(...boxes.map((rect) => rect.left));
      const top = Math.min(...boxes.map((rect) => rect.top));
      const right = Math.max(...boxes.map((rect) => rect.right));
      const bottom = Math.max(...boxes.map((rect) => rect.bottom));
      return { height: top + bottom, width: left + right };
    });
  await expect
    .poll(async () => {
      const [before, after] = await Promise.all(
        (await panes.all()).map(measure),
      );
      const width = Math.round(Math.max(before!.width, after!.width));
      const height = Math.round(Math.max(before!.height, after!.height));
      const label = await frame.locator("figcaption").textContent();
      return label?.includes(`${width} × ${height}`) ?? false;
    })
    .toBe(true);
  await expect(frame.locator("figcaption")).not.toContainText("1280 × 800");
});
