import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  documentExtent,
  expectStackAt,
  layerOffsets,
  openComparison,
  paneFrame,
  sampleFrames,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

const changed = comparisonPaths.changed;

/** Expect Side by side's two documents and viewports at one offset. */
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

test("Side by side mirrors its two viewports in both directions", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Side by side");
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
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const before = await documentExtent(paneFrame(desktop, "before"));
  const after = await documentExtent(paneFrame(desktop, "after"));
  const step = Math.max(1, Math.floor(after.height * 0.875));
  const end = Math.max(before.range, after.range);
  await paneFrame(desktop, "after").contentFrame().locator("h1").click();
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
  await expect
    .poll(async () => (await viewportOffset(sharedViewports(desktop))).y)
    .toBe(end);
  await page.keyboard.press("Home");
  await expectStackAt(desktop, 0);

  // An editable field keeps its keys, so the shared viewport stays.
  const field = paneFrame(desktop, "after").contentFrame().locator("#field");
  await field.click();
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await expect(field).toHaveValue(" ");
  await expectStackAt(desktop, 0);
});

test("a same-document anchor moves every version to its target", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const address = page.url();
  const desktop = comparisonSection(page, "desktop");
  const viewport = sharedViewports(desktop);
  // Overlay's top layer is the Current version.
  const after = paneFrame(desktop, "after").contentFrame();
  const target = await after
    .locator("#end")
    .evaluate((node) => node.getBoundingClientRect().top);
  await after.getByRole("link", { name: "Jump to the end" }).click();
  await expect
    .poll(async () => (await viewportOffset(viewport)).y)
    .toBeCloseTo(target, 0);
  await expect
    .poll(() =>
      after
        .locator("#end")
        .evaluate((node) => node.getBoundingClientRect().top),
    )
    .toBeCloseTo(0, 0);
  await expect(page).toHaveURL(address);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );

  await modeButton(page, "Side by side").click();
  await expect(desktop.locator(".browser-frame")).toHaveCount(2);
  const before = paneFrame(desktop, "before").contentFrame();
  await before.locator("h1").waitFor();
  await paneFrame(desktop, "before").evaluate((frame: HTMLIFrameElement) =>
    frame.contentDocument!.scrollingElement!.scrollTo({ top: 0 }),
  );
  await expectMirrored(desktop, 0);
  const beforeTarget = await before
    .locator("#end")
    .evaluate((node) => node.getBoundingClientRect().top);
  await before.getByRole("link", { name: "Jump to the end" }).click();
  for (const pane of await sharedViewports(desktop).all())
    await expect
      .poll(async () => (await viewportOffset(pane)).y)
      .toBeCloseTo(beforeTarget, 0);
  await expect(page).toHaveURL(address);
});

test("a scroll the viewer did not make pulls every version along", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const heading = paneFrame(desktop, "after").contentFrame().locator("#end");
  const top = await heading.evaluate(
    (node) => node.getBoundingClientRect().top,
  );
  await heading.evaluate((node) => node.scrollIntoView());
  await expect
    .poll(async () => (await viewportOffset(sharedViewports(desktop))).y)
    .toBeCloseTo(top, 0);
  const offsets = await layerOffsets(desktop);
  expect(offsets.after.y).toBeCloseTo(top, 0);
  expect(offsets.before.y).toBeCloseTo(
    Math.min(top, (await documentExtent(paneFrame(desktop, "before"))).range),
    0,
  );
});

test("links stay inert while a version is still loading", async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // The current version's stylesheet waits, so its document keeps loading.
  await page.route(
    "**/snapshots/after/mokly-generated/styles/changed.css",
    async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    },
  );
  try {
    await openComparison(page, changed, "desktop", "Overlay");
    const address = page.url();
    const desktop = comparisonSection(page, "desktop");
    const frame = paneFrame(desktop, "after");
    await expect
      .poll(() =>
        frame.evaluate(
          (element: HTMLIFrameElement) => element.contentDocument?.readyState,
        ),
      )
      .toBe("interactive");
    const source = await frame.getAttribute("data-mokly-preview-source");
    // Record each click that reaches the loading document's window.
    await frame.evaluate((element: HTMLIFrameElement) => {
      const view = element.contentWindow as Window & { clicks?: unknown[] };
      const clicks: unknown[] = [];
      view.clicks = clicks;
      view.addEventListener("click", (event) =>
        clicks.push([
          (event.target as Element).id,
          event.isTrusted,
          event.defaultPrevented,
        ]),
      );
    });
    const away = frame
      .contentFrame()
      .getByRole("link", { name: "Open the stable screen" });
    await expect(away).toBeVisible();
    // The held stylesheet blocks the frame's rendering, so its animation
    // frames never run and the stability check cannot end. The pointer
    // click still reaches the unpainted top layer, as a reader's click does.
    await away.click({ force: true });
    // The same window saw one trusted click on the link, cancelled.
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          (element.contentWindow as Window & { clicks?: unknown[] }).clicks,
      ),
    ).toEqual([["snapshot-link", true, true]]);
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.readyState,
      ),
    ).toBe("interactive");
    await expect(page).toHaveURL(address);
    await expect(frame.contentFrame().locator("h1")).toHaveText("After screen");
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

/** Each pane document's offset beside its shared viewport's, in one task. */
function readStack(section: Locator): Promise<[number, number][]> {
  return section.evaluate((element) => {
    const viewports = [
      ...element.querySelectorAll<HTMLElement>("[data-comparison-viewport]"),
    ];
    return (["before", "after"] as const).map((side, index) => {
      const frame = element.querySelector<HTMLIFrameElement>(
        `.mb-pane--${side} iframe`,
      )!;
      const viewport = viewports[Math.min(index, viewports.length - 1)]!;
      return [
        frame.contentDocument!.scrollingElement!.scrollTop,
        viewport.scrollTop,
      ];
    });
  });
}

/**
 * Every rendering update right after a wheel shows each document at its
 * viewport. When `mirrored`, Side by side's two viewports also show one offset
 * in every sampled frame.
 */
async function expectInstantFollow(
  page: Page,
  section: Locator,
  mirrored = false,
) {
  for (const sample of await sampleFrames(page, () => readStack(section), 20)) {
    for (const [document, viewport] of sample)
      expect(document, JSON.stringify(sample)).toBe(viewport);
    if (mirrored)
      expect(sample[1]![1], JSON.stringify(sample)).toBe(sample[0]![1]);
  }
}

test("smooth-scroll CSS in the documents and the host still moves every version at once", async ({
  page,
}) => {
  const smooth = "* { scroll-behavior: smooth !important; }";
  // Every presentation's stylesheet asks for smooth scrolling.
  await page.route(
    "**/snapshots/*/mokly-generated/styles/changed.css",
    async (route) => {
      const response = await route.fetch();
      const css = await response.text();
      await route.fulfill({ response, body: `${css}\n${smooth}\n` });
    },
  );
  await openComparison(page, changed, "desktop", "Overlay");
  await page.addStyleTag({ content: smooth });
  const desktop = comparisonSection(page, "desktop");
  const expectSmooth = async () => {
    for (const side of ["before", "after"] as const)
      await expect(
        paneFrame(desktop, side).contentFrame().locator("html"),
      ).toHaveCSS("scroll-behavior", "smooth");
  };
  await expectSmooth();
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectInstantFollow(page, desktop);
  await expectStackAt(desktop, 400);
  await wheelOver(page, paneFrame(desktop, "after"), -400);
  await expectInstantFollow(page, desktop);
  await expectStackAt(desktop, 0);

  // Side by side presents new documents, which ask for smooth scrolling too.
  await modeButton(page, "Side by side").click();
  await expect(sharedViewports(desktop)).toHaveCount(2);
  await expectSmooth();
  await expectMirrored(desktop, 0);
  await wheelOver(page, paneFrame(desktop, "before"), 300);
  await expectInstantFollow(page, desktop, true);
  await expectMirrored(desktop, 300);
});
