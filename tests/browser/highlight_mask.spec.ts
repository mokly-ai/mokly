import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { InstanceBoundary } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";

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

async function expectReportedMask(page: Page) {
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(1);
  await expect(page.locator(".mbk-highlight-mask")).toHaveCount(1);
  await expect(
    page
      .frameLocator('iframe[data-workspace-frame="desktop"]')
      .locator("[data-mokly-overlay], .mbk-highlight-layer"),
  ).toHaveCount(0);
  // The public adapter supplies frame-relative boxes. Read the rendered mask
  // to check the host's scale, border translation, and visible-frame clipping.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const frame = document.querySelector<HTMLIFrameElement>(
          'iframe[data-workspace-frame="desktop"]',
        )!;
        const layer = document.querySelector<HTMLElement>(
          ".mbk-highlight-layer",
        )!;
        const visible = layer.getBoundingClientRect();
        const rectangle = frame.getBoundingClientRect();
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
      }),
    )
    .toBe(true);
}

for (const cross of [false, true]) {
  test(`${cross ? "postMessage" : "same-origin"} shell masks follow reported geometry for public and workspace highlights`, async ({
    page,
  }) => {
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
                if (frame.dataset["workspaceFrame"] === "desktop")
                  window.maskBoundaries = boundaries;
                return boundaries;
              },
            };
          },
        },
      };
      host.render();
    }, cross);
    await expect(
      page.locator('iframe[data-workspace-frame="desktop"]'),
    ).toHaveAttribute("data-mokly-frame-state", "ready");
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
    await expectReportedMask(page);
    const outline = page.locator(".mbk-highlight-outline");
    const top = (await outline.boundingBox())!.y;
    await page
      .frameLocator('iframe[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Visible", exact: true })
      .evaluate((button) => {
        button.style.marginTop = "70px";
      });
    await expect
      .poll(async () => (await outline.boundingBox())?.y)
      .toBeGreaterThan(top + 40);
    await expectReportedMask(page);

    await page.locator(".browser-expand").click();
    await expect(page.locator(".mbk-highlight-layer")).toHaveCSS(
      "z-index",
      "951",
    );
    await expect(
      page
        .locator("[data-mokly-label-layer]")
        .filter({ has: page.getByRole("button", { name: "Action · action" }) }),
    ).toHaveCSS("z-index", "952");
    await expectReportedMask(page);
    await page.locator(".browser-expand").click();
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.highlightInstance(null),
    );
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);

    const toggle = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expectReportedMask(page);
    const workspaceTop = (await outline.boundingBox())!.y;
    await page
      .frameLocator('iframe[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Visible", exact: true })
      .evaluate((button) => {
        button.style.marginTop = "110px";
      });
    await expect
      .poll(async () => (await outline.boundingBox())?.y)
      .toBeGreaterThan(workspaceTop + 20);
    await expectReportedMask(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  });
}
