import { expect, test, type Locator, type Page } from "@playwright/test";

import { comparisonRegionsFixture } from "../helpers/comparison_regions_fixture.js";

import {
  comparisonSection,
  expectStackAt,
  openComparison,
  paneFrame,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_alignment_helpers.js";
import {
  expectPaneDocumentsKept,
  expectRegionsAt,
  markPaneDocuments,
  regionOffset,
  scrollTogether,
  settleRegion,
  wheelOverRegion,
} from "./comparison_regions_helpers.js";

let fixture: Awaited<ReturnType<typeof comparisonRegionsFixture>>;
test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(120_000);
  fixture = await comparisonRegionsFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

const STORAGE_KEY = "mokly:comparison-scroll-together";
const pageScreen = () => `${fixture.url}/view/page/`;

/** Snapshot documents requested after a comparison became ready. */
function paneRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (/\/snapshots\/(?:before|after)\//.test(request.url()))
      requested.push(request.url());
  });
  return requested;
}

/** Wait until a page viewport settles at an offset and stays there. */
async function expectViewportAt(viewport: Locator, y: number): Promise<void> {
  await expect.poll(async () => (await viewportOffset(viewport)).y).toBe(y);
}

test("off lets Side by side pages and panels part, and on realigns to the pane scrolled last", async ({
  page,
}) => {
  await openComparison(page, pageScreen(), "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  const [left, right] = await sharedViewports(desktop).all();
  await markPaneDocuments(desktop);
  const requests = paneRequests(page);
  const toggle = scrollTogether(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await wheelOverRegion(page, after, "#rg-code", 40);
  await settleRegion(page, after, "#rg-code", { y: 40 });
  expect(await regionOffset(before, "#rg-code")).toEqual({ x: 0, y: 0 });
  await wheelOverRegion(page, before, "#rg-code", 150);
  await settleRegion(page, before, "#rg-code", { y: 150 });
  expect(await regionOffset(after, "#rg-code")).toEqual({ x: 0, y: 40 });
  await wheelOver(page, before, 600);
  await expectViewportAt(left!, 600);
  await settleRegion(page, before, "#rg-code", { y: 150 });
  expect((await viewportOffset(right!)).y, "the other page stays").toBe(0);

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expectViewportAt(right!, 600);
  await expectRegionsAt(desktop, "#rg-code", [150, 150]);
  await wheelOver(page, after, -200);
  await expectViewportAt(left!, 400);
  await expectViewportAt(right!, 400);
  await expectPaneDocumentsKept(desktop);
  expect(requests).toEqual([]);
});

test("off keeps a stack's page together but frees its panels", async ({
  page,
}) => {
  await openComparison(page, pageScreen(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  await markPaneDocuments(desktop);
  const requests = paneRequests(page);
  const toggle = scrollTogether(page);
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await wheelOverRegion(page, after, "#rg-code", 80);
  await settleRegion(page, after, "#rg-code", { y: 80 });
  expect(await regionOffset(before, "#rg-code")).toEqual({ x: 0, y: 0 });
  await wheelOver(page, after, 300);
  await expectStackAt(desktop, 300);

  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await wheelOver(page, after, -300);
  await expectStackAt(desktop, 0);
  await wheelOverRegion(page, after, "#rg-code", 40);
  await settleRegion(page, after, "#rg-code", { y: 120 });
  expect(await regionOffset(before, "#rg-code")).toEqual({ x: 0, y: 0 });

  await toggle.click();
  await expectRegionsAt(desktop, "#rg-code", [120, 120]);
  await wheelOverRegion(page, after, "#rg-code", 40);
  await expectRegionsAt(desktop, "#rg-code", [160, 160]);
  await expectPaneDocumentsKept(desktop);
  expect(requests).toEqual([]);
});

test("Scroll together is remembered across screens and reloads", async ({
  page,
}) => {
  await openComparison(page, pageScreen(), "desktop", "Overlay");
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("off");

  await openComparison(page, `${fixture.url}/view/solo/`, "desktop", "Overlay");
  await expect(scrollTogether(page)).not.toBeChecked();
  const desktop = comparisonSection(page, "desktop");
  await wheelOverRegion(page, paneFrame(desktop, "after"), "#rg-solo", 200);
  await settleRegion(page, paneFrame(desktop, "after"), "#rg-solo", { y: 200 });
  expect(await regionOffset(paneFrame(desktop, "before"), "#rg-solo")).toEqual({
    x: 0,
    y: 0,
  });

  await page.reload();
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).toBeChecked();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("on");

  await page.evaluate((key) => localStorage.setItem(key, "maybe"), STORAGE_KEY);
  await page.reload();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
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
  await openComparison(page, pageScreen(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  await wheelOverRegion(page, paneFrame(desktop, "after"), "#rg-code", 60);
  await settleRegion(page, paneFrame(desktop, "after"), "#rg-code", { y: 60 });
  expect(await regionOffset(paneFrame(desktop, "before"), "#rg-code")).toEqual({
    x: 0,
    y: 0,
  });
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(scrollTogether(page)).not.toBeChecked();
});
