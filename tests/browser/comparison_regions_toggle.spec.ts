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
import { modeButton } from "./comparison_ui.js";

const STORAGE_KEY = "mokly:comparison-scroll-together";
const changed = comparisonPaths.changed;
const panel = "#panel";

/** Snapshot documents requested after a comparison became ready. */
function paneRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (/\/snapshots\/(?:before|after)\//.test(request.url()))
      requested.push(request.url());
  });
  return requested;
}

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
