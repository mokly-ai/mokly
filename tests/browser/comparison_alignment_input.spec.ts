import { expect, test, type Locator } from "@playwright/test";

import { comparisonAlignmentFixture } from "../helpers/comparison_alignment_fixture.js";
import { scaledTimeLimit } from "../helpers/time_limits.js";

import {
  comparisonSection,
  documentExtent,
  expectStackAt,
  sampleFrames,
  layerOffsets,
  openComparison,
  paneFrame,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_alignment_helpers.js";

let fixture: Awaited<ReturnType<typeof comparisonAlignmentFixture>>;
test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(scaledTimeLimit(120_000));
  fixture = await comparisonAlignmentFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

const tall = () => `${fixture.url}/view/tall/`;

/** Wait for both versions' late images so document heights are final. */
async function settleImages(section: Locator): Promise<void> {
  for (const side of ["before", "after"] as const)
    await expect
      .poll(() =>
        paneFrame(section, side)
          .contentFrame()
          .locator("#al-late")
          .evaluate(
            (image: HTMLImageElement) => image.complete && image.naturalHeight,
          ),
      )
      .toBeTruthy();
}

async function expectMirrored(section: Locator, y: number): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await layerOffsets(section);
      return [offsets.before.y, offsets.after.y];
    })
    .toEqual([y, y]);
  const viewports = sharedViewports(section);
  await expect(viewports).toHaveCount(2);
  for (const viewport of await viewports.all())
    await expect.poll(async () => (await viewportOffset(viewport)).y).toBe(y);
}

async function focusDocument(frame: Locator): Promise<void> {
  await frame.contentFrame().locator(".al-hero h1").click();
}

test("Side by side mirrors its two viewports in both directions", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  await expect(desktop.locator(".browser-frame")).toHaveCount(2);
  await wheelOver(page, paneFrame(desktop, "before"), 300);
  await expectMirrored(desktop, 300);
  await wheelOver(page, paneFrame(desktop, "after"), -100);
  await expectMirrored(desktop, 200);
});

test("scroll keys pressed inside a pane move the shared viewport", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await settleImages(desktop);
  const before = await documentExtent(paneFrame(desktop, "before"));
  const after = await documentExtent(paneFrame(desktop, "after"));
  const step = Math.max(1, Math.floor(after.height * 0.875));
  const end = Math.max(before.range, after.range);
  await focusDocument(paneFrame(desktop, "after"));
  await page.keyboard.press("Space");
  await expectStackAt(desktop, step);
  await page.keyboard.press("PageDown");
  await expectStackAt(desktop, step * 2);
  await page.keyboard.press("Shift+Space");
  await expectStackAt(desktop, step);
  await page.keyboard.press("PageUp");
  await expectStackAt(desktop, 0);
  await page.keyboard.press("ArrowDown");
  await expectStackAt(desktop, 40);
  await page.keyboard.press("End");
  await expectStackAt(desktop, end);
  await page.keyboard.press("Home");
  await expectStackAt(desktop, 0);

  const field = paneFrame(desktop, "after").contentFrame().locator("#al-field");
  await field.click();
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await expect(field).toHaveValue(" ");
  await expectStackAt(desktop, 0);
});

test("a same-document anchor moves every version to its target", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Overlay");
  const address = page.url();
  const desktop = comparisonSection(page, "desktop");
  await settleImages(desktop);
  const after = paneFrame(desktop, "after").contentFrame();
  const target = await after
    .locator("#al-target")
    .evaluate((node) => node.getBoundingClientRect().top);
  await after.getByRole("link", { name: "Jump to target" }).click();
  await expectStackAt(desktop, target);
  await expect
    .poll(() =>
      after
        .locator("#al-target")
        .evaluate((node) => node.getBoundingClientRect().top),
    )
    .toBe(0);
  await expect(page).toHaveURL(address);
  await expect(page.locator("#mb-main h2")).toHaveText("Tall");

  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(desktop.locator(".browser-frame")).toHaveCount(2);
  await settleImages(desktop);
  await paneFrame(desktop, "before")
    .contentFrame()
    .getByRole("link", { name: "Jump to target" })
    .click();
  await expectMirrored(desktop, target);
  await expect(page).toHaveURL(address);
});

test("a scroll the viewer did not make pulls every version along", async ({
  page,
}) => {
  await openComparison(page, tall(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await settleImages(desktop);
  const block = paneFrame(desktop, "after")
    .contentFrame()
    .locator("#al-block-5");
  const top = await block.evaluate((node) => node.getBoundingClientRect().top);
  await block.evaluate((node) => node.scrollIntoView());
  await expectStackAt(desktop, top);
});

test("links stay inert while a version is still loading", async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/snapshots/**/alignment-late.svg", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  try {
    await openComparison(page, tall(), "desktop", "Overlay");
    const address = page.url();
    const desktop = comparisonSection(page, "desktop");
    const frame = paneFrame(desktop, "after");
    const source = await frame.getAttribute("data-mokly-preview-source");
    const away = frame.contentFrame().getByRole("link", { name: "Open short" });
    await expect(away).toBeVisible();
    await away.click();
    await expect(page).toHaveURL(address);
    await expect(frame.contentFrame().locator("h1")).toHaveText("Current tall");
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    ).toBe("about:srcdoc");
    await expect(frame).toHaveAttribute("data-mokly-preview-source", source!);
  } finally {
    release();
  }
});

test("smooth-scrolling documents and hosts still move as one", async ({
  page,
}) => {
  await openComparison(
    page,
    `${fixture.url}/view/smooth/`,
    "desktop",
    "Overlay",
  );
  await page.addStyleTag({
    content: "* { scroll-behavior: smooth !important; }",
  });
  const desktop = comparisonSection(page, "desktop");
  const offsets = async () => {
    const layers = await layerOffsets(desktop);
    const viewports = await sharedViewports(desktop).evaluateAll((nodes) =>
      nodes.map((node) => node.scrollTop),
    );
    return [layers.before.y, layers.after.y, ...viewports];
  };
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  for (const sample of await sampleFrames(page, offsets, 20))
    expect(sample).toEqual([400, 400, 400]);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(sharedViewports(desktop)).toHaveCount(2);
  await wheelOver(page, paneFrame(desktop, "before"), 300);
  await expectMirrored(desktop, 300);
  for (const sample of await sampleFrames(page, offsets, 20))
    expect(sample).toEqual([300, 300, 300, 300]);
});
