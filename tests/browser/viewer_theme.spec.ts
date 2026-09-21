import { expect, test, type Page } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

const ROOT = "#one .mokly-viewer";
const FRAME = "#one .mbk-frag";

async function startHost(page: Page) {
  await page.evaluate(() => window.viewerHarness.start("one", { slots: true }));
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await expect(page.locator(FRAME).first()).toHaveAttribute("src", /\.html/);
}

test("an explicit theme paints the root and leaves the host page alone", async ({
  page,
}) => {
  await startHost(page);
  const hostBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  await page.evaluate(() => window.viewerHarness.get("one").setTheme("dark"));
  await expect(page.locator(ROOT)).toHaveAttribute("data-mokly-theme", "dark");
  await expect(page.locator(ROOT)).toHaveCSS(
    "background-color",
    "rgb(20, 24, 22)",
  );
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe(hostBackground);
  expect(
    await page.evaluate(() =>
      document.documentElement.hasAttribute("data-mokly-theme"),
    ),
  ).toBe(false);
});

test("two roots hold independent appearances", async ({ page }) => {
  await startHost(page);
  await page.evaluate(() => window.viewerHarness.start("two"));
  await page.waitForFunction(
    () => window.viewerHarness.get("two").ref.current !== null,
  );
  await page.evaluate(() => {
    window.viewerHarness.get("one").setTheme("dark");
    window.viewerHarness.get("two").setTheme("light");
  });
  await expect(page.locator(ROOT)).toHaveCSS(
    "background-color",
    "rgb(20, 24, 22)",
  );
  await expect(page.locator("#two .mokly-viewer")).toHaveCSS(
    "background-color",
    "rgb(244, 244, 241)",
  );
});

test("a host slot keeps its own styling under a dark root", async ({
  page,
}) => {
  await startHost(page);
  await page.evaluate(() => window.viewerHarness.get("one").setTheme("dark"));
  // Slot content belongs to the host, so the scoped shell stops at its boundary.
  const slot = page.locator('#one [data-mokly-slot="topBarStart"] button');
  await expect(slot).toBeVisible();
  expect(
    await slot.evaluate((element) => getComputedStyle(element).fontFamily),
  ).not.toContain("Mokly Inter");
});

test("an appearance change preserves everything the reader is doing", async ({
  page,
}) => {
  await startHost(page);
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.setMarkers([
      {
        id: "marker",
        instance: {
          screenId: "home",
          viewport: "mobile",
          colorScheme: "light",
          key: "action",
        },
      },
    ]);
    await host.ref.current.startPick();
  });
  await expect(page.locator("#one [data-mokly-marker-layer]")).toBeVisible();

  const before = await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#one .mbk-frag")!;
    const identity =
      (frame as unknown as { __identity?: number }).__identity ?? Math.random();
    (frame as unknown as { __identity?: number }).__identity = identity;
    const host = window.viewerHarness.get("one");
    return {
      identity,
      src: frame.src,
      events: host.events.length,
      requests: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes(".html")).length,
    };
  });

  await page.evaluate(() => window.viewerHarness.get("one").setTheme("dark"));
  await expect(page.locator(ROOT)).toHaveAttribute("data-mokly-theme", "dark");
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#one .mbk-frag")!;
    const host = window.viewerHarness.get("one");
    return {
      identity: (frame as unknown as { __identity?: number }).__identity,
      src: frame.src,
      events: host.events.length,
      requests: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes(".html")).length,
      layer: (
        document.querySelector("#one [data-mokly-marker-layer]") as unknown as {
          __identity?: number;
        }
      )?.__identity,
    };
  });

  expect(after.identity, "the frame element was replaced").toBe(
    before.identity,
  );
  expect(after.src, "the frame reloaded").toBe(before.src);
  expect(after.events, "an appearance change emitted an event").toBe(
    before.events,
  );
  expect(after.requests, "an appearance change requested a fragment").toBe(
    before.requests,
  );
  expect(after.layer, "the marker layer was remounted").toBe(before.layer);
});

test("the preview scheme is independent of the interface", async ({ page }) => {
  await startHost(page);
  await page.evaluate(() => window.viewerHarness.get("one").setTheme("dark"));
  const frame = page.locator(FRAME).first();
  // A light preview inside a dark interface keeps its own light surfaces.
  await expect(frame).toHaveCSS("color-scheme", "light");
  await expect(page.locator(ROOT)).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
});
