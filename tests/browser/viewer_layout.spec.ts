import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import {
  INDEX_PATH,
  removedEntryDetailPath,
} from "../../packages/viewer/src/catalogue/delivery_paths.js";
import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import {
  comparisonPaths,
  copiedComparisonDirectory,
} from "./comparison_test.js";
import { comparisonViewerHost } from "./comparison_viewer_host.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;

test.beforeAll(async () => {
  fixture = await viewerFixture();
});

test.afterAll(async () => {
  await fixture?.close();
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
        const hostStart = await page
          .getByRole("button", { name: "Host start" })
          .elementHandle();
        const hostEnd = await page
          .getByRole("button", { name: "Host end" })
          .elementHandle();
        await toggle.click();
        const search = page.getByRole("searchbox", {
          name: "Search catalogue",
        });
        await expect(search).toBeFocused();
        const input = await search.boundingBox();
        expect(input?.width).toBeGreaterThanOrEqual(160);
        expect(await hostStart?.evaluate((node) => node.isConnected)).toBe(
          true,
        );
        expect(await hostEnd?.evaluate((node) => node.isConnected)).toBe(true);
        await search.press("Escape");
        await expect(toggle).toBeVisible();

        await toggle.click();
        await expect(search).toBeVisible();
        expect(await hostStart?.evaluate((node) => node.isConnected)).toBe(
          true,
        );
        expect(await hostEnd?.evaluate((node) => node.isConnected)).toBe(true);
        await page.getByRole("button", { name: "Close search" }).click();
        await expect(toggle).toBeVisible();
      }
    });
  }
}

for (const rootFontSize of [10, 20]) {
  test(`the compact search follows a 560px viewer with a ${rootFontSize}px root font`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
      window.viewerHarness.start("one", { responsive: true });
    }, rootFontSize);
    await page.waitForFunction(() =>
      Boolean(window.viewerHarness.get("one").ref.current),
    );

    const host = page.locator("#one");
    const control = host.getByRole("button", { name: "Search catalogue" });
    const field = host.getByRole("searchbox", { name: "Search catalogue" });
    // The viewer contract switches at a 560px container, whatever the root font.
    for (const [width, compact] of [
      [560, true],
      [561, false],
    ] as const) {
      await host.evaluate((element, value) => {
        element.style.width = `${value}px`;
      }, width);
      await expect
        .poll(() =>
          host
            .locator(".mokly-top-host")
            .evaluate((top) => top.getBoundingClientRect().width),
        )
        .toBe(width);
      await expect(compact ? control : field).toBeVisible();
      await expect(compact ? field : control).toBeHidden();
    }
  });
}

test("an embedded missing-capture note keeps its width and wrapping at different root font sizes", async ({
  page,
}) => {
  const source = await fs.mkdtemp(path.join(fixture.root, "preview-note-"));
  let host: Awaited<ReturnType<typeof comparisonViewerHost>> | undefined;
  try {
    await fs.cp(copiedComparisonDirectory(), source, { recursive: true });
    const indexFile = path.join(source, INDEX_PATH);
    const index = readCatalogueIndex(
      JSON.parse(await fs.readFile(indexFile, "utf8")),
    );
    const removed = index.removedEntries.find(
      ({ entry }) => entry.path === comparisonPaths.removedScreen,
    );
    if (removed?.entry.kind !== "screen" || !index.comparisonUrl)
      throw new Error("Missing removed screen comparison fixture");
    const detailFile = path.join(
      source,
      removedEntryDetailPath(index.comparisonUrl, removed.entry.path),
    );
    const detail = readEntryDetail(
      JSON.parse(await fs.readFile(detailFile, "utf8")),
    );
    // Both records describe a historical screen with no mobile capture.
    removed.entry.views = removed.entry.views.filter(
      ({ viewport }) => viewport !== "mobile",
    );
    detail.views = detail.views.filter(({ viewport }) => viewport !== "mobile");
    await fs.writeFile(indexFile, JSON.stringify(index));
    await fs.writeFile(detailFile, JSON.stringify(detail));
    host = await comparisonViewerHost(source);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${host.url}/viewer.html?adapter=same-origin&responsive=1&view=changes&entry=${removed.entry.path}&viewport=mobile`,
    );
    const note = page.getByRole("status").filter({
      hasText: "No previous mobile version was captured.",
    });
    await expect(note).toHaveText(
      "No previous mobile version was captured. Switch to Desktop to see it.",
    );
    await expect(note).toBeVisible();
    await note.evaluate(async (element) => {
      await element.ownerDocument.fonts.ready;
    });

    const layouts = [];
    for (const rootFontSize of [10, 20]) {
      await page.locator("html").evaluate((element, size) => {
        element.style.fontSize = `${size}px`;
      }, rootFontSize);
      layouts.push(
        await note.evaluate((element) => {
          const lines = new Map<number, string>();
          const texts = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
          );
          const range = document.createRange();
          for (let text = texts.nextNode(); text; text = texts.nextNode()) {
            const value = text.textContent ?? "";
            for (let offset = 0; offset < value.length; offset++) {
              range.setStart(text, offset);
              range.setEnd(text, offset + 1);
              const top = range.getBoundingClientRect().top;
              lines.set(top, (lines.get(top) ?? "") + value[offset]);
            }
          }
          return {
            width: element.getBoundingClientRect().width,
            lines: [...lines.values()].map((line) => line.trim()),
          };
        }),
      );
    }
    expect(layouts[0]!.width).toBeGreaterThan(0);
    expect(layouts[0]!.lines.length).toBeGreaterThan(1);
    expect(layouts[1]!.width).toBe(layouts[0]!.width);
    expect(layouts[1]!.lines).toEqual(layouts[0]!.lines);
  } finally {
    await host?.close();
    await fs.rm(source, { recursive: true, force: true });
  }
});
