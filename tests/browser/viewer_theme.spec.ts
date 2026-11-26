import { expect, type Page } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";
import { canvasFrame, NARROW_WINDOW } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
let dualFixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
  dualFixture = await viewerFixture({
    actionRender:
      '(props, context) => <div style={{ colorScheme: context.colorScheme }}><input data-native-control="" type="date" /><button>{props.label}</button></div>',
    body: '<action.Component label="Visible" />',
  });
});
test.afterAll(async () => {
  await fixture?.close();
  await dualFixture?.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

const ROOT = "#one .mokly-viewer";
const FRAME = "#one .mbk-frag";

async function startHost(page: Page, options: Record<string, unknown> = {}) {
  await page.evaluate(
    (options) => window.viewerHarness.start("one", { slots: true, ...options }),
    options,
  );
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await expect(page.locator(FRAME).first()).toHaveAttribute("src", /\.html/);
}

/**
 * Expect the mobile frames of a root: on the canvas each frame keeps its own
 * scheme, apart from the theme and the preview scheme alike; below the
 * layout breakpoint the compact layout's one shown frame is the frame of the
 * preview scheme.
 */
async function expectMobileFrames(
  page: Page,
  id: string,
  preview: "dark" | "light",
  canvas: boolean,
): Promise<void> {
  const frames = canvas
    ? (["light", "dark"] as const).map(
        (scheme) =>
          [`#${id} ${canvasFrame("mobile", scheme)}`, scheme] as const,
      )
    : ([
        [
          `#${id} .mbk-canvas-cell:not([hidden]) iframe[data-workspace-frame="mobile"]`,
          preview,
        ],
      ] as const);
  for (const [selector, scheme] of frames) {
    const frame = page.locator(selector);
    await expect(frame).toHaveCSS("color-scheme", scheme);
    await expect(frame).toHaveAttribute(
      "src",
      scheme === "dark"
        ? /home\/index\.mobile\.dark\.html$/u
        : /home\/index\.mobile\.html$/u,
    );
    const nativeControl = page
      .frameLocator(selector)
      .locator("[data-native-control]");
    await expect(nativeControl).toBeVisible();
    await expect(nativeControl).toHaveCSS("color-scheme", scheme);
  }
}

// The viewer sets the scheme of each frame, and the document sets the scheme
// of its controls, so the pairing runs on one adapter. The adapters have their
// own specs.
for (const canvas of [true, false])
  test(`${canvas ? "" : "below the layout breakpoint, "}same-origin frames keep every Light/Dark theme and preview pairing independent`, async ({
    page,
  }) => {
    if (!canvas) await page.setViewportSize(NARROW_WINDOW);
    await page.goto(dualFixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    for (const theme of ["light", "dark"] as const) {
      for (const preview of ["light", "dark"] as const) {
        const id = `same-origin-${theme}-${preview}`;
        await page.evaluate(
          ({ id, preview, theme }) => {
            const host = window.viewerHarness.start(id, {
              defaultSelection: { colorScheme: preview },
            });
            host.setTheme(theme);
          },
          { id, preview, theme },
        );
        await page.waitForFunction(
          (id) => window.viewerHarness.get(id).ref.current !== null,
          id,
        );
        const root = page.locator(`#${id} .mokly-viewer`);
        await expect(root).toHaveAttribute("data-mokly-theme", theme);
        await expect(root).toHaveAttribute("data-mokly-color-scheme", preview);
        await expectMobileFrames(page, id, preview, canvas);
      }
    }
  });

test("embedded Auto follows the host system without moving its preview", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(dualFixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => window.viewerHarness.start("auto"));
  const root = page.locator("#auto .mokly-viewer");
  const frame = page.locator(`#auto ${canvasFrame("mobile")}`);
  await expect(root).toHaveAttribute("data-mokly-theme", "auto");
  await expect(root).toHaveCSS("background-color", "rgb(17, 17, 19)");
  await expect(frame).toHaveCSS("color-scheme", "light");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveCSS("background-color", "rgb(241, 242, 238)");
  await expect(frame).toHaveCSS("color-scheme", "light");
});

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
    "rgb(17, 17, 19)",
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
    "rgb(17, 17, 19)",
  );
  await expect(page.locator("#two .mokly-viewer")).toHaveCSS(
    "background-color",
    "rgb(241, 242, 238)",
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
  ).not.toContain("Mokly Geist");
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
          screenPath: "home",
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
    // Tag each element, so a remount is visible as a lost tag rather than
    // something a selector would happily find again.
    const mark = (element: Element | null): number | undefined => {
      if (!element) return undefined;
      const tagged = element as unknown as { __identity?: number };
      tagged.__identity ??= Math.random();
      return tagged.__identity;
    };
    const host = window.viewerHarness.get("one");
    return {
      identity: mark(frame),
      layer: mark(document.querySelector("#one [data-mokly-marker-layer]")),
      src: frame.src,
      events: host.events.length,
      requests: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes(".html")).length,
    };
  });

  await page.evaluate(() => window.viewerHarness.get("one").setTheme("dark"));
  await expect(page.locator(ROOT)).toHaveAttribute("data-mokly-theme", "dark");
  await page.evaluate(() => new Promise(requestAnimationFrame));

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
