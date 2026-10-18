import { expect, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectPaneDocumentsKept,
  expectRegionsAt,
  expectStackAt,
  markPaneDocuments,
  openComparison,
  paneFrame,
  regionOffset,
  scrollTogether,
  settleRegion,
  viewportOffset,
  wheelOver,
  wheelOverRegion,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

const STORAGE_KEY = "mokly:comparison-scroll-together";
const REVIEW = "**/mokly-viewer/diffs/generations/*/review.json";
const changed = comparisonPaths.changed;
const panel = "#panel";

type Box = { bottom: number; left: number; right: number; top: number };

/** Geometry of the comparison band's controls. */
function band(page: Page) {
  return page.locator(".mbk-diff-toolbar").evaluate((toolbar) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    };
    const style = getComputedStyle(toolbar);
    const control = toolbar.querySelector(".mbk-diff-sync")!;
    return {
      content: {
        left:
          toolbar.getBoundingClientRect().left + parseFloat(style.paddingLeft),
        right:
          toolbar.getBoundingClientRect().right -
          parseFloat(style.paddingRight),
      },
      control: box(control),
      label: control.textContent,
      modes: box(toolbar.querySelector(".mbk-seg")!),
      order: [...toolbar.children]
        .filter((child) => !(child as HTMLElement).hidden)
        .map((child) => child.className),
      refresh: box(toolbar.querySelector(".mbk-diff-refresh")!),
    };
  });
}

/** Snapshot documents requested after a comparison became ready. */
function paneRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (/\/snapshots\/(?:before|after)\//.test(request.url()))
      requested.push(request.url());
  });
  return requested;
}

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/view/${changed}/`);
  await chooseViewport(page, "desktop");
}

test("Current shows no switch; every diff mode shows it on, after the modes", async ({
  page,
}) => {
  await open(page, 1600);
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await expect(scrollTogether(page)).toBeHidden();
  await expect(page.locator(".mbk-diff-sync")).toBeHidden();
  for (const mode of ["Side by side", "Overlay", "Difference"] as const) {
    await modeButton(page, mode).click();
    const toggle = scrollTogether(page);
    await expect(toggle, mode).toBeVisible();
    await expect(toggle, mode).toBeChecked();
    await expect(toggle, mode).toHaveAttribute("type", "checkbox");
    await expect(page.locator(".mbk-diff-refresh")).toBeVisible();
    const facts = await band(page);
    expect(facts.order, mode).toEqual([
      "mbk-seg",
      "mbk-diff-sync",
      "mbk-diff-refresh",
    ]);
    expect(facts.label, mode).toBe("Scroll together");
    expect(facts.control.left, mode).toBeGreaterThan(facts.modes.right);
    expect(facts.control.top, mode).toBeLessThan(facts.modes.bottom);
    expect(Math.abs(facts.refresh.right - facts.content.right)).toBeLessThan(
      0.5,
    );
  }
  await modeButton(page, "Current").click();
  await expect(scrollTogether(page)).toBeHidden();
});

test("a narrow band gives the modes the first row and the switch the second", async ({
  page,
}) => {
  await open(page, 800);
  await modeButton(page, "Overlay").click();
  await expect(page.locator(".mbk-diff-refresh")).toBeVisible();
  const facts = await band(page);
  expect([
    facts.modes.left - facts.content.left,
    facts.content.right - facts.modes.right,
  ]).toEqual([0, 0]);
  expect(facts.control.top).toBeGreaterThanOrEqual(facts.modes.bottom);
  expect(facts.control.left).toBe(facts.content.left);
  expect(facts.refresh.top).toBeGreaterThanOrEqual(facts.modes.bottom);
  expect(Math.abs(facts.refresh.right - facts.content.right)).toBeLessThan(0.5);
});

test("the switch stays while a comparison loads and after it fails", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  allowBrowserError(responseFailure(baseURL!, `/${index.comparisonUrl}`, 500));
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(REVIEW, async (route) => {
    await held;
    await route.fulfill({ status: 500, body: "unavailable" });
  });
  await open(page, 1600);
  await modeButton(page, "Overlay").click();
  const stage = page.locator("[data-diff-stage]");
  await expect(stage).toContainText("Loading comparison");
  await expect(scrollTogether(page)).toBeVisible();
  await expect(scrollTogether(page)).toBeChecked();
  release();
  await expect(stage).toContainText("The comparison could not be loaded.");
  await expect(scrollTogether(page)).toBeVisible();
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
});

test("off lets Side by side pages and panels part, and on realigns to the pane scrolled last", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  const [left, right] = await desktop
    .locator("[data-comparison-viewport]")
    .all();
  await markPaneDocuments(desktop);
  const requests = paneRequests(page);
  const toggle = scrollTogether(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await wheelOverRegion(page, after, panel, 40);
  await settleRegion(page, after, panel, 40);
  expect(await regionOffset(before, panel)).toEqual({ x: 0, y: 0 });
  await wheelOverRegion(page, before, panel, 150);
  await settleRegion(page, before, panel, 150);
  expect(await regionOffset(after, panel)).toEqual({ x: 0, y: 40 });
  await wheelOver(page, before, 600);
  await expect.poll(async () => (await viewportOffset(left!)).y).toBe(600);
  await settleRegion(page, before, panel, 150);
  expect((await viewportOffset(right!)).y, "the other page stays").toBe(0);

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect.poll(async () => (await viewportOffset(right!)).y).toBe(600);
  await expectRegionsAt(desktop, panel, [150, 150]);
  await wheelOver(page, after, -200);
  await expect.poll(async () => (await viewportOffset(left!)).y).toBe(400);
  await expect.poll(async () => (await viewportOffset(right!)).y).toBe(400);
  await expectPaneDocumentsKept(desktop);
  expect(requests).toEqual([]);
});

test("off keeps a stack's page together but frees its panels", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  await markPaneDocuments(desktop);
  const requests = paneRequests(page);
  const toggle = scrollTogether(page);
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await wheelOverRegion(page, after, panel, 80);
  await settleRegion(page, after, panel, 80);
  expect(await regionOffset(before, panel)).toEqual({ x: 0, y: 0 });
  await wheelOver(page, after, 300);
  await expectStackAt(desktop, 300);

  await modeButton(page, "Difference").click();
  await expect(toggle).not.toBeChecked();
  await wheelOver(page, after, -300);
  await expectStackAt(desktop, 0);
  await wheelOverRegion(page, after, panel, 40);
  await settleRegion(page, after, panel, 120);
  expect(await regionOffset(before, panel)).toEqual({ x: 0, y: 0 });

  await toggle.click();
  await expectRegionsAt(desktop, panel, [120, 120]);
  await wheelOverRegion(page, after, panel, 40);
  await expectRegionsAt(desktop, panel, [160, 160]);
  await expectPaneDocumentsKept(desktop);
  expect(requests).toEqual([]);
});

test("Scroll together is remembered across screens and reloads", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("off");

  await openComparison(page, comparisonPaths.component, "desktop", "Overlay");
  await expect(scrollTogether(page)).not.toBeChecked();

  await page.reload();
  await modeButton(page, "Side by side").click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("on");

  await page.evaluate((key) => localStorage.setItem(key, "maybe"), STORAGE_KEY);
  await page.reload();
  await modeButton(page, "Overlay").click();
  await expect(scrollTogether(page)).toBeChecked();
});

test("a store that refuses the choice keeps it for the open document", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("The store is blocked");
    };
  });
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await wheelOverRegion(page, paneFrame(desktop, "after"), panel, 60);
  await settleRegion(page, paneFrame(desktop, "after"), panel, 60);
  expect(await regionOffset(paneFrame(desktop, "before"), panel)).toEqual({
    x: 0,
    y: 0,
  });
  await modeButton(page, "Side by side").click();
  await expect(scrollTogether(page)).not.toBeChecked();
});
