/**
 * The embedded top bar under the viewer contract: the host's centre slot in
 * the middle of the bar, the one row of the compact bar, and the two top-bar
 * insets with which a host clears its own window controls.
 */

import { expect, type Page } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;

test.beforeAll(async () => {
  fixture = await viewerFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

/** The parts of the embedded bar that the checks measure. */
const PARTS = {
  bar: "#one .mbk-topbar",
  menu: "#one .mbk-menu",
  mark: "#one .mbk-mark",
  start: '#one [data-mokly-slot="topBarStart"]',
  centre: '#one [data-mokly-slot="topBarCenter"]',
  centreContent: '#one [data-mokly-slot="topBarCenter"] > *',
  toggle: "#one .mbk-search-toggle",
  search: "#one .mbk-search",
  close: "#one .mbk-search-close",
  end: '#one [data-mokly-slot="topBarEnd"]',
} as const;

type Part = keyof typeof PARTS;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The box of each shown part. The page measures them, which lays out the
 * whole bar, its container query included, after a style change.
 */
async function measure(page: Page): Promise<Partial<Record<Part, Box>>> {
  return page.evaluate((parts) => {
    const boxes: Record<string, Box> = {};
    for (const [name, selector] of Object.entries(parts)) {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === "none") continue;
      const { left, right, top, bottom } = element.getBoundingClientRect();
      boxes[name] = { left, right, top, bottom };
    }
    return boxes;
  }, PARTS);
}

/** The boxes of the named parts, each of which must show. */
async function shown<const Names extends readonly Part[]>(
  page: Page,
  names: Names,
): Promise<{ [Name in Names[number]]: Box }> {
  const boxes = await measure(page);
  const missing = names.filter((name) => boxes[name] === undefined);
  expect(missing, "parts that do not show").toEqual([]);
  return boxes as { [Name in Names[number]]: Box };
}

/** Each box ends before the next one starts. */
function expectInOrder(boxes: readonly [string, Box][]) {
  for (let index = 1; index < boxes.length; index++) {
    const [previous, before] = boxes[index - 1]!;
    const [next, after] = boxes[index]!;
    expect(before.right, `${previous} ends before ${next}`).toBeLessThanOrEqual(
      after.left,
    );
  }
}

async function startBar(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() =>
    window.viewerHarness.start("one", {
      responsive: true,
      topBarCenter: true,
      topBarSlots: true,
    }),
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

/**
 * Leave the start slot empty, keep the end slot, and fill the centre slot
 * with the harness's content or with a text that the test gives.
 */
async function leaveStartEmpty(page: Page, centre?: string) {
  await page.evaluate((label) => {
    const host = window.viewerHarness.get("one");
    const slots = host.props.slots!;
    host.props.slots = {
      topBarCenter: label ?? slots.topBarCenter,
      topBarEnd: slots.topBarEnd,
    };
    host.render();
  }, centre);
  await expect(page.locator(PARTS.start)).toBeEmpty();
}

async function setInsets(page: Page, start: string, end: string) {
  await page.evaluate(
    ([start, end]) => {
      const host = document.getElementById("one")!;
      host.style.setProperty("--mokly-top-bar-inset-start", start);
      host.style.setProperty("--mokly-top-bar-inset-end", end);
    },
    [start, end] as const,
  );
}

for (const width of [1440, 800]) {
  test(`the host's centre slot sits in the middle of the embedded bar at ${width}px`, async ({
    page,
  }) => {
    await startBar(page, width);
    const { bar, mark, start, centre, search, end } = await shown(page, [
      "bar",
      "mark",
      "start",
      "centre",
      "search",
      "end",
    ]);
    // The host's start and end differ in width, and the centre stays put.
    expect(
      Math.abs((centre.left + centre.right) / 2 - (bar.left + bar.right) / 2),
    ).toBeLessThanOrEqual(0.5);
    const menu = (await measure(page)).menu;
    expect(Boolean(menu)).toBe(width < 900);
    expectInOrder([
      ...(menu ? [["menu", menu] as [string, Box]] : []),
      ["mark", mark],
      ["start", start],
      ["centre", centre],
      ["search", search],
      ["end", end],
    ]);
    expect((menu ?? mark).left - bar.left).toBe(12);
    expect(bar.right - end.right).toBe(12);
    // The start slot fills its column, up to the gap before the centre.
    expect(centre.left - start.right).toBeCloseTo(12, 0);
  });
}

for (const [width, gap, next] of [
  [1024, 12, "search"],
  [390, 8, "toggle"],
] as const) {
  test(`an empty start slot gives the centre slot the free room after the mark at ${width}px`, async ({
    page,
  }) => {
    await startBar(page, width);
    await leaveStartEmpty(page);
    // An empty start slot takes no room.
    expect((await measure(page)).start).toBeUndefined();
    const parts = await shown(page, ["mark", "centre", "centreContent", next]);
    const { mark, centre } = parts;
    // The centre content starts right after the mark, and its slot takes the
    // free room up to the end column.
    expect(centre.left - mark.right).toBeCloseTo(gap, 0);
    expect(parts.centreContent.left).toBeCloseTo(centre.left, 0);
    expect(parts[next].left - centre.right).toBeCloseTo(gap, 0);
    // Content wider than the room overflows its slot, so that host text can
    // truncate, and the end column stays where it is.
    const label = "Publication".repeat(12);
    await leaveStartEmpty(page, label);
    await expect(page.locator(PARTS.centre)).toHaveText(label);
    const wide = await shown(page, ["centre", next]);
    const across = (box: Box) => [box.left, box.right];
    expect(across(wide.centre)).toEqual(across(centre));
    expect(across(wide[next])).toEqual(across(parts[next]));
    expect(
      await page
        .locator(PARTS.centre)
        .evaluate((slot) => slot.scrollWidth > slot.clientWidth),
    ).toBe(true);
  });
}

test("the compact embedded bar holds its parts in one row, and its start slot takes the room", async ({
  page,
}) => {
  await startBar(page, 390);
  const parts = await shown(page, [
    "bar",
    "menu",
    "mark",
    "start",
    "centre",
    "toggle",
    "end",
  ]);
  const { bar, menu, start, centre, end } = parts;
  expectInOrder([
    ["menu", menu],
    ["mark", parts.mark],
    ["start", start],
    ["centre", centre],
    ["search button", parts.toggle],
    ["end", end],
  ]);
  for (const [name, box] of Object.entries(parts))
    if (name !== "bar")
      expect(
        box.top >= bar.top && box.bottom <= bar.bottom,
        `${name} sits in the bar's row`,
      ).toBe(true);
  // The start slot grows up to the centre slot's gap.
  expect(centre.left - start.right).toBe(8);
  expect(menu.left - bar.left).toBe(8);
  expect(bar.right - end.right).toBe(8);
});

for (const [width, padding] of [
  [1440, 12],
  [390, 8],
] as const) {
  test(`the top-bar insets move the bar's content in from each edge at ${width}px`, async ({
    page,
  }) => {
    await startBar(page, width);
    // The first part of the bar: the menu where it shows, or else the mark.
    const first = async () => {
      const boxes = await measure(page);
      return (boxes.menu ?? boxes.mark)!;
    };
    await setInsets(page, "80px", "50px");
    let { bar, end } = await shown(page, ["bar", "end"]);
    expect((await first()).left - bar.left).toBe(80);
    expect(bar.right - end.right).toBe(50);
    // An inset smaller than the bar's padding keeps the padding.
    await setInsets(page, "5px", "5px");
    ({ bar, end } = await shown(page, ["bar", "end"]));
    expect((await first()).left - bar.left).toBe(padding);
    expect(bar.right - end.right).toBe(padding);
  });
}

test("the open compact search keeps clear of the top-bar insets", async ({
  page,
}) => {
  await startBar(page, 390);
  await setInsets(page, "80px", "50px");
  await page.getByRole("button", { name: "Search catalogue" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toBeFocused();
  const { bar, search, close } = await shown(page, ["bar", "search", "close"]);
  expect(search.left - bar.left).toBe(80);
  expect(bar.right - close.right).toBe(50);
});
