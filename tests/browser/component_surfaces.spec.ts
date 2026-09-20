import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

test("desktop inspector uses a centered divider with real bounded resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(componentDesignUrl("controls/editing/edited", "desktop"));
  const divider = page.locator(".ce-inspector-resize");
  await expect(divider).toBeVisible();
  const region = page.locator(".ce-preview-region");
  const inspector = page.locator(".ce-inspector");
  const before = (await inspector.boundingBox())!;
  const grip = (await divider.boundingBox())!;
  const mark = await divider.locator(".mbk-nav-resize").evaluate((node) => {
    const style = getComputedStyle(node, "::after");
    return (
      node.getBoundingClientRect().y +
      parseFloat(style.top) +
      parseFloat(style.height) / 2
    );
  });
  expect(mark, "grip sits on the inspector border").toBeCloseTo(
    before.y + 0.5,
    0,
  );
  const shell = (await page.locator(".ce-workspace").boundingBox())!;
  expect(grip.x + grip.width / 2).toBeCloseTo(shell.x + shell.width / 2, 0);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2,
    grip.y + grip.height / 2 - 70,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await inspector.boundingBox())!.height)
    .toBeGreaterThan(before.height + 50);
  const resized = await region.boundingBox();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(divider).toBeHidden();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  expect(await region.boundingBox()).toEqual(resized);
  await expect(page.locator(".ce-preview-pane")).toHaveCSS("resize", "none");
  await page.setViewportSize({ width: 1440, height: 600 });
  const smaller = (await page.locator(".ce-workspace").boundingBox())!;
  const bounded = (await region.boundingBox())!;
  expect(bounded.height).toBeGreaterThanOrEqual(96);
  expect(bounded.height).toBeLessThanOrEqual(smaller.height - 120);
  const nextGrip = (await divider.boundingBox())!;
  const x = nextGrip.x + nextGrip.width / 2;
  const y = nextGrip.y + nextGrip.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, smaller.y + 20, { steps: 10 });
  await page.mouse.up();
  expect((await region.boundingBox())!.height).toBe(96);
});

test.describe("mobile inspector sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("sheet overlays the preview and its grabber changes size without losing edits", async ({
    page,
  }) => {
    await page.goto(componentDesignUrl("controls/editing/edited", "mobile"));
    const dock = page.locator(".ce-inspector-dock");
    const inspector = page.locator(".ce-inspector");
    const preview = page.locator(".ce-preview-pane");
    const workspace = (await page.locator(".ce-workspace").boundingBox())!;
    const toggle = page.getByRole("switch", { name: "Expanded inspector" });
    await expect(toggle).toBeVisible();
    const previewBounds = (await preview.boundingBox())!;
    const compact = (await dock.boundingBox())!;
    expect(compact.y).toBeLessThan(previewBounds.y + previewBounds.height - 80);
    expect(compact.y).toBeGreaterThan(previewBounds.y);
    expect(compact.x).toBeCloseTo(workspace.x, 0);
    expect(compact.width).toBeCloseTo(workspace.width, 0);
    await expect(dock).toHaveCSS("border-top-left-radius", "0px");
    await expect(dock).toHaveCSS("box-shadow", "none");
    await expect(inspector).toHaveCSS("border-top-left-radius", "20px");
    await expect(inspector).not.toHaveCSS("box-shadow", "none");
    const label = page.getByRole("textbox", { name: "label", exact: true });
    await label.fill("Keep my edits");
    await toggle.tap();
    await expect(toggle).toBeChecked();
    await expect
      .poll(async () => (await dock.boundingBox())!.height)
      .toBeGreaterThan(compact.height + 80);
    expect(await preview.boundingBox()).toEqual(previewBounds);
    await expect(label).toHaveValue("Keep my edits");
    await toggle.focus();
    await page.keyboard.press("Space");
    expect(await dock.boundingBox()).toEqual(compact);
    await page.locator("details[open] [data-inspector-close]").click();
    await expect(toggle).toBeHidden();
    await expect(page.locator(".ce-inspector details[open]")).toHaveCount(0);
    await page.getByRole("button", { name: "Controls", exact: true }).tap();
    await expect(label).toHaveValue("Keep my edits");
    expect(await preview.boundingBox()).toEqual(previewBounds);
    const panel = page.locator("details[open] .ce-inspector-panel");
    await panel.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(
      page.getByRole("textbox", { name: "hint", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight - innerHeight,
      ),
    ).toBeLessThanOrEqual(1);
  });
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: menu, caret, and Usage use centered unclipped SVGs`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(componentDesignUrl("overview", viewport));
    const usage = page.locator('[data-panel="usage"] > summary > svg');
    const ink = await usage.evaluate((node) => {
      const box = (node as SVGGraphicsElement).getBBox();
      return {
        x: box.x,
        y: box.y,
        right: box.x + box.width,
        bottom: box.y + box.height,
      };
    });
    expect(ink.x).toBeGreaterThanOrEqual(1);
    expect(ink.y).toBeGreaterThanOrEqual(1);
    expect(ink.right).toBeLessThanOrEqual(15);
    expect(ink.bottom).toBeLessThanOrEqual(15);
    const chevron = page.locator('[data-view-icon="chevron"]');
    await expect(chevron).toBeVisible();
    const icon = await page
      .locator(`.ce-viewport-control [data-view-icon="${viewport}"]`)
      .boundingBox();
    const caret = (await chevron.boundingBox())!;
    expect(caret.y + caret.height / 2).toBeCloseTo(
      icon!.y + icon!.height / 2,
      0,
    );
    if (viewport === "mobile") {
      const menu = page.locator(".mbk-menu-btn");
      const svg = menu.locator("svg");
      await expect(svg).toBeVisible();
      const target = (await menu.boundingBox())!;
      const mark = (await svg.boundingBox())!;
      expect(mark.x + mark.width / 2).toBeCloseTo(
        target.x + target.width / 2,
        0,
      );
      expect(mark.y + mark.height / 2).toBeCloseTo(
        target.y + target.height / 2,
        0,
      );
    }
  });
}
