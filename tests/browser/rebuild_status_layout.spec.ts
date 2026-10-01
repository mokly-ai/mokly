import { expect, test, type Page } from "@playwright/test";

import { viewHref } from "@mokly/viewer/data";

import {
  captureBrowserErrors,
  expectCleanHydration,
} from "./react_shell_hydration_helpers.js";
import {
  LONG_DETAIL_LINES,
  watchedRebuildServe,
  type WatchedRebuildServe,
} from "./rebuild_status_fixture.js";
import {
  COPY,
  detail,
  geometry,
  hydrated,
  instrument,
  notice,
  progress,
  summary,
} from "./rebuild_status_page.js";

const SIZES = {
  desktop: { height: 900, width: 1440 },
  mobile: { height: 844, width: 390 },
} as const;

/**
 * One route of every kind the shell serves, each with its heading and the text
 * that proves the route really is that kind.
 */
const ROUTES = [
  ["home", "/", "Mokly", "Browse the mockup catalogue"],
  ["screen", viewHref("screen", "home"), "Home", "Unmodified"],
  ["component", viewHref("component", "counter"), "Counter", "Variant"],
  [
    "page",
    viewHref("page", "guide"),
    "Guide",
    "Description, rationale, source, related docs, and use cases",
  ],
  [
    "flow",
    viewHref("use-case", "tour"),
    "Tour",
    "This screen in the catalogue",
  ],
  [
    "comparison",
    `${viewHref("screen", "details")}?comparison=side`,
    "Details",
    "Before",
  ],
  [
    "removed",
    viewHref("screen", "retired"),
    "Retired",
    "Showing previous version",
  ],
  ["missing", "/view/unknown.html", "Item not found", "view/unknown.html"],
] as const;

/** Chrome's report of the missing route's own 404 document response. */
const MISSING_DOCUMENT =
  "Failed to load resource: the server responded with a status of 404 (Not Found)";

let serve: WatchedRebuildServe;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  serve = await watchedRebuildServe();
});

test.afterAll(async () => {
  await serve?.close();
});

test.afterEach(async () => {
  await serve.restore();
});

async function failWith(source: string): Promise<void> {
  await serve.save(source);
  await serve.waitForStatus((status) => !!status.failure && !status.updating);
}

/** Every region except the search field keeps its box while progress shows. */
async function expectOnlySearchNarrows(page: Page): Promise<void> {
  await expect(progress(page)).toHaveCount(0);
  const before = await geometry(page);
  const field = (await page.locator(".mbk-search").boundingBox())!;
  await serve.gate.arm();
  await serve.save(serve.sources.held("fail"));
  await serve.gate.entered();
  await expect(progress(page)).toHaveText(COPY.progress, { timeout: 15_000 });
  expect(await geometry(page)).toEqual(before);
  const narrowed = (await page.locator(".mbk-search").boundingBox())!;
  const slot = (await progress(page).boundingBox())!;
  const appearance = (await page.locator(".mbk-appearance").boundingBox())!;
  expect(narrowed.x).toBeCloseTo(field.x, 1);
  expect(narrowed.width).toBeLessThan(field.width);
  expect(narrowed.height, "the field keeps one line").toBe(30);
  await expect(page.locator("[data-mokly-search]")).toHaveCSS(
    "text-overflow",
    "ellipsis",
  );
  expect(slot.height).toBe(30);
  expect(slot.x).toBeGreaterThan(narrowed.x + narrowed.width);
  expect(slot.x + slot.width).toBeLessThan(appearance.x);
  await serve.gate.release();
  await expect(progress(page)).toHaveCount(0, { timeout: 60_000 });
}

for (const [viewport, size] of Object.entries(SIZES)) {
  test(`${viewport}: every route kind shows the notice in the same place`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size);
    await failWith(serve.sources.broken);
    const errors = captureBrowserErrors(page);
    for (const [kind, route, heading, marker] of ROUTES) {
      const response = await page.goto(`${serve.url}${route}`);
      expect(response?.status(), kind).toBe(kind === "missing" ? 404 : 200);
      await expect(notice(page), kind).toBeVisible();
      if (kind === "missing") {
        await expect.poll(() => errors.includes(MISSING_DOCUMENT)).toBe(true);
        errors.splice(errors.indexOf(MISSING_DOCUMENT), 1);
      }
      await expectCleanHydration(page, errors, `${kind} hydrates cleanly`);
      await expect(page.locator("#mb-main h2").first(), kind).toHaveText(
        heading,
      );
      await expect(page.locator("#mb-main"), kind).toContainText(marker);
      const { body, notice: box, topBar } = await geometry(page);
      expect(box, kind).toEqual({
        height: viewport === "desktop" ? 57 : 101,
        width: size.width,
        x: 0,
        y: topBar!.y + topBar!.height,
      });
      expect(body!.y, kind).toBe(box!.y + box!.height);
      const card = (await page.locator(".mbk-rebuild-card").boundingBox())!;
      expect(card.x, kind).toBe(viewport === "desktop" ? 16 : 12);
      for (const frame of page.frames().slice(1))
        expect(await frame.locator(".mbk-rebuild").count(), kind).toBe(0);
    }
  });

  test(`${viewport}: progress moves nothing but the search field's end`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);
    await instrument(page);
    await page.goto(`${serve.url}${viewHref("screen", "home")}`);
    await hydrated(page);
    await expectOnlySearchNarrows(page);
    await failWith(serve.sources.broken);
    await page.reload();
    await hydrated(page);
    await expect(notice(page)).toBeVisible();
    await expectOnlySearchNarrows(page);
  });

  test(`${viewport}: the detail wraps, scrolls in its bound and takes focus`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(size);
    await failWith(serve.sources.long);
    await page.goto(`${serve.url}${viewHref("screen", "home")}`);
    await hydrated(page);
    const control = summary(page);
    await control.focus();
    await expect(control).toHaveCSS("outline-style", "solid");
    await expect(control).toHaveCSS("outline-width", "2px");
    const closed = (await control.boundingBox())!;
    await page.keyboard.press("Enter");
    await expect(control).toHaveAccessibleName(COPY.hide);
    expect(await control.boundingBox(), "opening never moves it").toEqual(
      closed,
    );
    await page.keyboard.press("Tab");
    const region = detail(page);
    await expect(region).toBeFocused();
    await expect(region).toContainText(LONG_DETAIL_LINES.at(-1)!);
    const measured = await region.evaluate((node) => ({
      client: node.clientHeight,
      height: node.getBoundingClientRect().height,
      overflow: node.scrollWidth - node.clientWidth,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      scroll: node.scrollHeight,
    }));
    expect(measured.height).toBeLessThanOrEqual(168);
    expect(measured.scroll).toBeGreaterThan(measured.client);
    expect(measured.overflow, "long tokens wrap").toBe(0);
    expect(measured.page, "no sideways page scrolling").toBe(0);
    await page.keyboard.press("End");
    await expect
      .poll(() => region.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await expect(region).toHaveCount(0);
    await expect(control).toHaveAccessibleName(COPY.show);
  });
}

test("mobile: the drawer opens under the bar and over the notice", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(SIZES.mobile);
  await failWith(serve.sources.broken);
  await page.goto(`${serve.url}${viewHref("screen", "home")}`);
  await hydrated(page);
  await page.locator("[data-mokly-menu]").click();
  const drawer = page.locator("[data-mokly-nav]");
  await expect(drawer).toBeVisible();
  const box = (await drawer.boundingBox())!;
  const covered = (await notice(page).boundingBox())!;
  expect(box.y, "the drawer starts under the bar").toBe(48);
  expect(
    await page.evaluate(
      ([x, y]) =>
        document.elementFromPoint(x!, y!)?.closest("[data-mokly-nav]") !== null,
      [box.x + 24, covered.y + covered.height / 2],
    ),
    "the drawer covers the notice",
  ).toBe(true);
});

test("reduced motion stills the ring and keeps the text", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${serve.url}${viewHref("screen", "home")}`);
  await hydrated(page);
  await serve.gate.arm();
  await serve.save(serve.sources.held("fail"));
  await serve.gate.entered();
  await expect(progress(page)).toHaveText(COPY.progress, { timeout: 15_000 });
  await expect(page.locator(".mbk-progress-spinner")).toHaveCSS(
    "animation-name",
    "none",
  );
  await serve.gate.release();
});

test("unwatched Serve shows neither the notice nor the progress slot", async ({
  page,
}) => {
  await page.goto(viewHref("screen", "welcome"));
  await hydrated(page);
  await expect(page.locator(".mbk-search")).toBeVisible();
  await expect(
    page.locator(".mbk-rebuild, .mbk-search-slot, .mbk-progress"),
  ).toHaveCount(0);
});
