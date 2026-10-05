import { expect, test, type Locator } from "@playwright/test";

import { comparisonAlignmentFixture } from "../helpers/comparison_alignment_fixture.js";
import {
  ALIGNMENT_LATE_IMAGE_HEIGHT,
  ALIGNMENT_SHORT_CANVAS,
  ALIGNMENT_SHORT_HEIGHTS,
} from "../helpers/comparison_alignment_source.js";

import {
  comparisonSection,
  cssPixels,
  documentExtent,
  documentOffset,
  expectCoincidentLayers,
  expectStackAt,
  layerOffsets,
  openComparison,
  pageTop,
  paneFrame,
  sampleFrames,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_alignment_helpers.js";

let fixture: Awaited<ReturnType<typeof comparisonAlignmentFixture>>;
test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(120_000);
  fixture = await comparisonAlignmentFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

const tall = () => `${fixture.url}/view/tall/`;

async function expectPresentedFrames(section: Locator): Promise<void> {
  for (const side of ["before", "after"] as const) {
    const frame = paneFrame(section, side);
    await expect(frame).toHaveAttribute("data-mokly-comparison-frame", "");
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).toHaveAttribute("scrolling", "no");
    await expect(frame).toHaveAttribute("srcdoc", /al-page/);
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      new RegExp(`/snapshots/${side}/tall/index\\.desktop\\.html$`),
    );
    await expect(frame).not.toHaveAttribute("src", /.*/);
    await expect(section.locator(`.mb-pane--${side} .mb-pane-doc`)).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
  }
}

test("Overlay and Difference scroll one desktop stack as one", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(desktop);
  await expect(desktop.locator(".browser-frame")).toHaveCount(1);
  await expect(desktop.locator(".browser-expand")).toHaveCount(0);
  await expectPresentedFrames(desktop);

  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(desktop.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  const start = (await viewportOffset(sharedViewports(desktop))).y;
  await wheelOver(page, paneFrame(desktop, "after"), 300);
  await expectStackAt(desktop, start + 300);
  await expectCoincidentLayers(desktop);
  await expect(desktop.locator(".mb-pane--after")).toHaveCSS(
    "mix-blend-mode",
    "difference",
  );
  await expect(desktop.locator(".browser-frame")).toHaveCSS(
    "mix-blend-mode",
    "normal",
  );
});

test("a mobile stack scrolls inside the phone screen", async ({ page }) => {
  await openComparison(page, tall(), "mobile", "Overlay");
  const mobile = comparisonSection(page, "mobile");
  await wheelOver(page, paneFrame(mobile, "after"), 300);
  await expectStackAt(mobile, 300);
  await expectCoincidentLayers(mobile);
  await expect(mobile.locator(".phone-frame")).toHaveCount(1);
  const band = await mobile.locator(".phone-status").boundingBox();
  const viewport = await sharedViewports(mobile).boundingBox();
  expect(viewport!.y).toBeGreaterThanOrEqual(band!.y + band!.height);
});

test("both viewports keep one stack each", async ({ page }) => {
  await openComparison(page, tall(), "both", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const mobile = comparisonSection(page, "mobile");
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectStackAt(mobile, 0);
  await wheelOver(page, paneFrame(mobile, "after"), 200);
  await expectStackAt(mobile, 200);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(mobile);
  await expectCoincidentLayers(desktop);
});

test("a component comparison scrolls inside its bordered frame", async ({
  page,
}) => {
  await openComparison(
    page,
    `${fixture.url}/view/checklist/long/`,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  await wheelOver(page, paneFrame(desktop, "after"), 200);
  await expectStackAt(desktop, 200);
  await expectCoincidentLayers(desktop);
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(1);
});

test("a shorter document stays aligned past its own end", async ({ page }) => {
  await openComparison(
    page,
    `${fixture.url}/view/short/`,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  const { height } = await documentExtent(paneFrame(desktop, "after"));
  const afterEnd = ALIGNMENT_SHORT_HEIGHTS.after - height;
  const expectAligned = async (offset: number) => {
    await expect
      .poll(async () => {
        const offsets = await layerOffsets(desktop);
        return [offsets.before.y, offsets.after.y];
      })
      .toEqual([offset, Math.min(offset, afterEnd)]);
    expect((await viewportOffset(sharedViewports(desktop))).y).toBe(offset);
    for (const row of [0, 9])
      expect(
        await pageTop(paneFrame(desktop, "after"), `#al-short-${row}`),
      ).toBe(await pageTop(paneFrame(desktop, "before"), `#al-short-${row}`));
  };
  await wheelOver(page, paneFrame(desktop, "after"), 500);
  await expectAligned(500);
  await wheelOver(page, paneFrame(desktop, "after"), 5_000);
  await expectAligned(ALIGNMENT_SHORT_HEIGHTS.before - height);
  await expect(desktop.locator(".mb-pane--after .mb-pane-doc")).toHaveCSS(
    "background-image",
    new RegExp(ALIGNMENT_SHORT_CANVAS.replace(/[()]/g, "\\$&")),
  );
  await expect(desktop.locator(".mb-pane--after .mb-pane-doc")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
});

test("a viewport-height hero cannot grow its comparison", async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/snapshots/**/alignment-late.svg", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  await openComparison(page, tall(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const spacer = desktop.locator("[data-comparison-spacer]");
  const frames = desktop.locator("iframe");
  const viewport = sharedViewports(desktop);
  const sizes = async () => ({
    spacer: await cssPixels(spacer, "height"),
    frames: await frames.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    ),
    viewport: await viewport.evaluate((element) => element.clientHeight),
  });
  await expect.poll(async () => (await sizes()).spacer).toBeGreaterThan(0);
  const early = await sampleFrames(page, sizes);
  expect(new Set(early.map((sample) => JSON.stringify(sample))).size).toBe(1);
  expect(early[0]!.frames).toEqual([early[0]!.viewport, early[0]!.viewport]);

  release();
  await expect
    .poll(async () => (await sizes()).spacer)
    .toBe(early[0]!.spacer + ALIGNMENT_LATE_IMAGE_HEIGHT);
  const late = await sampleFrames(page, sizes);
  expect(new Set(late.map((sample) => JSON.stringify(sample))).size).toBe(1);
  expect(late[0]!.frames).toEqual([late[0]!.viewport, late[0]!.viewport]);
});

test("fixed bars and sticky headers stay on the chrome viewport edges", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOver(page, paneFrame(desktop, "after"), 900);
  await expectStackAt(desktop, 900);
  const bottom = await sharedViewports(desktop).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + element.clientHeight;
  });
  for (const side of ["before", "after"] as const) {
    const frame = paneFrame(desktop, side);
    expect(await pageTop(frame, ".al-header")).toBe(
      (await sharedViewports(desktop).boundingBox())!.y,
    );
    const bar = await frame
      .contentFrame()
      .locator(".al-bar")
      .evaluate((node) => ({
        bottom: node.getBoundingClientRect().bottom,
        inner: node.ownerDocument.defaultView!.innerHeight,
      }));
    expect(bar.bottom).toBe(bar.inner);
    expect((await pageTop(frame, ".al-bar")) + 40).toBe(bottom);
  }
});

test("an inner scroll region scrolls every version while the page stays", async ({
  page,
}) => {
  await openComparison(
    page,
    `${fixture.url}/view/inner/`,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  await expect
    .poll(() =>
      cssPixels(desktop.locator("[data-comparison-spacer]"), "height"),
    )
    .toBe(0);
  await wheelOver(page, paneFrame(desktop, "after"), 300);
  const inner = (side: "after" | "before") =>
    paneFrame(desktop, side)
      .contentFrame()
      .locator("#al-inner")
      .evaluate((node) => node.scrollTop);
  await expect.poll(() => inner("after")).toBe(300);
  await expect.poll(() => inner("before")).toBe(300);
  for (const side of ["before", "after"] as const)
    expect(await documentOffset(paneFrame(desktop, side))).toEqual({
      x: 0,
      y: 0,
    });
  expect((await viewportOffset(sharedViewports(desktop))).y).toBe(0);
});
