import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { InstanceBoundary } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";
import {
  canvasFrame,
  chooseViewport,
  NARROW_WINDOW,
  revealInPanel,
} from "./workspace_actions.js";

declare global {
  interface Window {
    maskBoundaries: readonly InstanceBoundary[];
  }
}

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture({
    body: '<action.Component label="Visible" />',
  });
});
test.afterAll(async () => fixture?.close());

type Layout = "canvas" | "narrow";

/**
 * The desktop frame whose mask the test reads: the scaled Desktop · Light
 * frame of the canvas, which the compact layout below the layout breakpoint
 * shows alone for a Desktop and Light selection.
 */
function desktopFrame(layout: Layout): string {
  return layout === "canvas"
    ? canvasFrame("desktop")
    : `.mbk-canvas-cell:not([hidden]) ${canvasFrame("desktop")}`;
}

/** How much the shell scales the frame's document, in page pixels per pixel. */
function frameScale(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluate(
      (frame: HTMLIFrameElement) =>
        frame.getBoundingClientRect().width / frame.offsetWidth,
    );
}

/**
 * The top of the outline in the layer over the frame. Each highlighted frame
 * has its own layer, which lies within the frame's box.
 */
function outlineTop(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((selector) => {
    const frame = document.querySelector(selector)!.getBoundingClientRect();
    const layer = [
      ...document.querySelectorAll<HTMLElement>(".mbk-highlight-layer"),
    ].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return (
        box.left >= frame.left - 1 &&
        box.right <= frame.right + 1 &&
        box.top >= frame.top - 1 &&
        box.bottom <= frame.bottom + 1
      );
    });
    const outline = layer?.querySelector(".mbk-highlight-outline");
    return outline ? outline.getBoundingClientRect().y : null;
  }, selector);
}

async function expectReportedMask(page: Page, selector: string, layers = 1) {
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(layers);
  await expect(page.locator(".mbk-highlight-mask")).toHaveCount(layers);
  await expect(
    page
      .frameLocator(selector)
      .locator("[data-mokly-overlay], .mbk-highlight-layer"),
  ).toHaveCount(0);
  // The public adapter supplies frame-relative boxes. Read the rendered mask
  // to check the host's scale, border translation, and visible-frame clipping.
  await expect
    .poll(() =>
      page.evaluate((selector) => {
        const frame = document.querySelector<HTMLIFrameElement>(selector)!;
        const rectangle = frame.getBoundingClientRect();
        const layer = [
          ...document.querySelectorAll<HTMLElement>(".mbk-highlight-layer"),
        ].find((candidate) => {
          const box = candidate.getBoundingClientRect();
          return (
            box.left >= rectangle.left - 1 &&
            box.right <= rectangle.right + 1 &&
            box.top >= rectangle.top - 1 &&
            box.bottom <= rectangle.bottom + 1
          );
        });
        if (!layer) return false;
        const visible = layer.getBoundingClientRect();
        const scaleX = rectangle.width / frame.offsetWidth;
        const scaleY = rectangle.height / frame.offsetHeight;
        const expected = window.maskBoundaries.flatMap(({ ranges }) =>
          ranges.flatMap(({ boxes }) =>
            boxes.map((box) => ({
              x:
                rectangle.left +
                (box.x + frame.clientLeft) * scaleX -
                visible.left,
              y:
                rectangle.top +
                (box.y + frame.clientTop) * scaleY -
                visible.top,
              width: box.width * scaleX,
              height: box.height * scaleY,
            })),
          ),
        );
        const actual = [
          ...layer.querySelectorAll(".mbk-highlight-outline"),
        ].map((rect) =>
          Object.fromEntries(
            ["x", "y", "width", "height"].map((key) => [
              key,
              Number(rect.getAttribute(key)),
            ]),
          ),
        );
        return (
          actual.length > 0 &&
          actual.length === expected.length &&
          expected.every((box, index) =>
            Object.entries(box).every(
              ([coordinate, value]) =>
                Math.abs(actual[index]![coordinate]! - value) <= 0.02,
            ),
          )
        );
      }, selector),
    )
    .toBe(true);
}

for (const layout of ["canvas", "narrow"] as const)
  for (const cross of [false, true]) {
    test(`${layout}: ${cross ? "postMessage" : "same-origin"} shell masks follow reported geometry for public and workspace highlights`, async ({
      page,
    }) => {
      if (layout === "narrow") await page.setViewportSize(NARROW_WINDOW);
      const desktop = desktopFrame(layout);
      await page.goto(fixture.host.url);
      await page.waitForFunction(() => Boolean(window.viewerHarness));
      // The public highlight handle has no visible control. Capture its adapter
      // replies so the mask assertion checks the reported boxes, not guessed DOM.
      await page.evaluate((cross) => {
        const host = window.viewerHarness.start("one", {
          cross,
          defaultSelection: { screenPath: "home", viewport: "desktop" },
        });
        const adapter = host.props.frameAdapter!;
        host.props = {
          ...host.props,
          frameAdapter: {
            async mount(frame, view) {
              const mounted = await adapter.mount(frame, view);
              return {
                ...mounted,
                async listInstanceBoundaries() {
                  const boundaries = await mounted.listInstanceBoundaries();
                  // The light desktop frame: the canvas also shows a dark one.
                  if (
                    frame.dataset["workspaceFrame"] === "desktop" &&
                    frame.dataset["workspaceColorScheme"] !== "dark"
                  )
                    window.maskBoundaries = boundaries;
                  return boundaries;
                },
              };
            },
          },
        };
        host.render();
      }, cross);
      await expect(page.locator(desktop)).toHaveAttribute(
        "data-mokly-frame-state",
        "ready",
      );
      await page.evaluate(async () => {
        const host = window.viewerHarness.get("one");
        const usage = host.details["home"]!.views.find(
          (view) => view.viewport === "desktop" && view.colorScheme === "light",
        )!.usage;
        if (usage.status !== "ready") throw new Error("Expected ready usage");
        await host.ref.current.highlightInstance({
          screenPath: "home",
          viewport: "desktop",
          colorScheme: "light",
          key: usage.instances[0]!.key,
        });
      });
      await expectReportedMask(page, desktop);
      // A move inside the frame moves the outline by the frame's scale.
      const scale = await frameScale(page, desktop);
      const top = await outlineTop(page, desktop);
      expect(top).not.toBeNull();
      await page
        .frameLocator(desktop)
        .getByRole("button", { name: "Visible", exact: true })
        .evaluate((button) => {
          button.style.marginTop = "70px";
        });
      await expect
        .poll(() => outlineTop(page, desktop))
        .toBeGreaterThan(top! + 40 * scale);
      await expectReportedMask(page, desktop);
      await page.evaluate(() =>
        window.viewerHarness.get("one").ref.current.highlightInstance(null),
      );
      await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);

      // The Highlight components switch draws on every shown frame: on the
      // canvas, the Desktop column's Light and Dark frames, which the Frames
      // filter shows alone. In the compact layout the switch stands in the
      // panel's sheet.
      const shown = layout === "canvas" ? 2 : 1;
      if (layout === "canvas") await chooseViewport(page, "desktop");
      const toggle = page.getByRole("switch", {
        name: "Highlight components",
        exact: true,
      });
      await revealInPanel(page, toggle);
      await toggle.click();
      await expect(toggle).toBeChecked();
      await expectReportedMask(page, desktop, shown);
      const workspaceTop = await outlineTop(page, desktop);
      expect(workspaceTop).not.toBeNull();
      await page
        .frameLocator(desktop)
        .getByRole("button", { name: "Visible", exact: true })
        .evaluate((button) => {
          button.style.marginTop = "110px";
        });
      await expect
        .poll(() => outlineTop(page, desktop))
        .toBeGreaterThan(workspaceTop! + 20 * scale);
      await expectReportedMask(page, desktop, shown);
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    });
  }
