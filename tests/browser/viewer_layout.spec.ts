import { expect, test } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;

test.beforeAll(async () => {
  fixture = await viewerFixture();
});

test.afterAll(async () => {
  await fixture.close();
});

test("embedded viewer fills a host shorter than the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => {
    window.viewerHarness.start("one", { responsive: true });
    document.getElementById("one")!.style.height = "500px";
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );

  const heights = await page.locator("#one .mokly-viewer").evaluate((root) => ({
    host: root.parentElement!.getBoundingClientRect().height,
    viewer: root.getBoundingClientRect().height,
  }));

  expect(heights).toEqual({ host: 500, viewer: 500 });
});

for (const width of [1440, 900, 390, 320]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`embedded layout owns ${width}px ${colorScheme} scrolling and sizing`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(fixture.host.url);
      await page.waitForFunction(() => Boolean(window.viewerHarness));
      await page.evaluate(
        ({ colorScheme }) =>
          window.viewerHarness.start("one", {
            defaultSelection: { colorScheme },
            responsive: true,
            topBarSlots: true,
          }),
        { colorScheme },
      );
      await page.waitForFunction(() =>
        Boolean(window.viewerHarness.get("one").ref.current),
      );

      const layout = await page
        .locator("#one .mokly-viewer")
        .evaluate((root) => {
          const host = root.parentElement!;
          const style = getComputedStyle(root);
          return {
            display: style.display,
            flexDirection: style.flexDirection,
            fontSize: style.fontSize,
            height: root.getBoundingClientRect().height,
            hostHeight: host.getBoundingClientRect().height,
            scrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
          };
        });
      expect(layout).toEqual({
        display: "flex",
        flexDirection: "column",
        fontSize: "13px",
        height: 900,
        hostHeight: 900,
        scrollHeight: 900,
        viewportHeight: 900,
      });

      if (width === 1440) {
        const desktop = await page.evaluate(() => {
          const nav = document.querySelector<HTMLElement>("#one .mbk-nav")!;
          const stage = document.querySelector<HTMLElement>(
            "#one .mokly-stage-host",
          )!;
          const navBounds = nav.getBoundingClientRect();
          const stageBounds = stage.getBoundingClientRect();
          return {
            detailsDisplay: getComputedStyle(
              document.querySelector("#one .mbk-details-body")!,
            ).display,
            navRight: navBounds.right,
            navTop: navBounds.top,
            stageLeft: stageBounds.left,
            stageTop: stageBounds.top,
          };
        });
        expect(desktop.detailsDisplay).toBe("grid");
        expect(desktop.navRight).toBeLessThanOrEqual(desktop.stageLeft);
        expect(desktop.navTop).toBe(desktop.stageTop);
      }

      if (width <= 390) {
        const toggle = page.getByRole("button", { name: "Search catalogue" });
        await expect(toggle).toBeVisible();
        const target = await toggle.boundingBox();
        expect(target?.width).toBeGreaterThanOrEqual(30);
        expect(target?.height).toBeGreaterThanOrEqual(30);
        await toggle.click();
        const search = page.getByRole("searchbox", {
          name: "Search catalogue",
        });
        await expect(search).toBeFocused();
        const input = await search.boundingBox();
        expect(input?.width).toBeGreaterThanOrEqual(160);
      }
    });
  }
}
