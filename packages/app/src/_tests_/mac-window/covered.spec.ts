import type { Locator, Page } from "@playwright/test";

import { expect, open, test } from "../harness";
import { publishedProject, publishedViewerReady } from "../viewer/support";

import { countHitTests, drawnTwice } from "./hit-tests";
import {
  clearMacWindow,
  emulateMacWindow,
  emulateMacWindowAtStart,
  expectMovesWindow,
  expectStopsMovingWindow,
} from "./regions";
import { scrollToEnd, scrollToStart } from "./scroll";

/** What a test expects of one part of a top bar. */
type PartExpectation = (part: Locator, label: string) => Promise<void>;

/** The smallest window that the desktop app opens. Sign-in scrolls in it. */
const smallestWindow = { width: 640, height: 480 };

/**
 * The narrowest Mac window, 640px wide, at the second zoom step, 120%. The
 * viewer package opens its compact search over its whole bar at this width.
 */
const zoomedNarrowWindow = { width: 533, height: 700 };

/**
 * A narrow window of another size, as when it enters or leaves full screen.
 * The compact search still covers the whole bar at this width.
 */
const resizedNarrowWindow = { width: 520, height: 700 };

/**
 * Expect the same of the cloud's slots in the viewer's top bar: the start, the
 * centre and the end slot of the full bar, or the centre and the end slot of
 * the compact bar, which leaves its start slot empty.
 */
async function expectSlots(
  page: Page,
  expectation: PartExpectation,
  when: string,
  bar: "full" | "compact" = "full",
) {
  for (const [label, slot] of [
    ...(bar === "full"
      ? ([["the start slot", page.locator(".fo-package-slot-start")]] as const)
      : []),
    ["the centre slot", page.locator(".fo-package-slot-center")],
    ["the end slot", page.locator(".fo-package-slot-end")],
  ] as const) {
    await expectation(slot, `${label}, ${when},`);
  }
}

test("in the Mac window, the viewer's focused skip link turns off the bar slot that it covers until it loses focus", async ({
  page,
}) => {
  // With the buttons at the end, the full bar starts its start slot directly
  // after the package's mark, under the link.
  await emulateMacWindowAtStart(page, "end");
  const made = await publishedProject(page, "mac-window-covered-link");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  await expectSlots(page, expectMovesWindow, "at rest");

  // The viewer's skip link shows over the bar while it has keyboard focus.
  // It comes directly before the package's mark in the tab order, so
  // Shift+Tab from the mark reaches it without the cloud's skip link, which
  // also covers the start slot.
  const viewer = page.locator("[data-mokly-shell]");
  const mark = viewer.getByRole("link", { name: "Mokly", exact: true });
  const skip = viewer.getByRole("link", { name: "Skip to content" });
  await mark.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await expectStopsMovingWindow(
    page.locator(".fo-package-slot-start"),
    "the start slot, under the link,",
  );
  for (const [label, slot] of [
    ["the centre slot", page.locator(".fo-package-slot-center")],
    ["the end slot", page.locator(".fo-package-slot-end")],
  ] as const) {
    await expectMovesWindow(slot, `${label}, beside the link,`);
  }

  await page.keyboard.press("Tab");
  await expect(mark).toBeFocused();
  await expect(skip).not.toBeInViewport();
  await expectSlots(page, expectMovesWindow, "after the link loses focus");
});

test("in the Mac window, the open compact search turns off the bar slots of a narrow viewer until it closes", async ({
  page,
}) => {
  await emulateMacWindowAtStart(page, "start");
  const made = await publishedProject(page, "mac-window-covered-search");
  await page.setViewportSize(zoomedNarrowWindow);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  await expectSlots(page, expectMovesWindow, "at rest", "compact");

  const toggle = page.getByRole("button", { name: "Search catalogue" });
  await toggle.click();
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toBeFocused();
  await expectSlots(
    page,
    expectStopsMovingWindow,
    "under the open search",
    "compact",
  );

  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expectSlots(
    page,
    expectMovesWindow,
    "after the search closes",
    "compact",
  );
});

test("in the Mac window, the focused skip link turns off the account header under it until it scrolls away or loses focus", async ({
  page,
}) => {
  await emulateMacWindowAtStart(page, "start");
  await page.setViewportSize(smallestWindow);
  await open(page, "/sign-in");
  const header = page.getByRole("banner");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expectMovesWindow(header, "the account header at rest");

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expectStopsMovingWindow(header, "the account header under the link");

  // The header stays at the top, and the page takes the link away from
  // under it, with the focus still on the link.
  await scrollToEnd(page);
  await expect(skip).toBeFocused();
  await expectMovesWindow(header, "the account header after a scroll");
  await scrollToStart(page);
  await expectStopsMovingWindow(header, "the account header, scrolled back,");

  await page.keyboard.press("Tab");
  await expect(skip).not.toBeFocused();
  await expectMovesWindow(header, "the account header after the link");
});

test("in the Mac window, an open settings dialog over the bar keeps the bar moving the window", async ({
  page,
}) => {
  const hitTests = await countHitTests(page);
  await emulateMacWindowAtStart(page, "start");
  const made = await publishedProject(page, "mac-window-covered-dialog");
  // In a short window the dialog reaches over the bar.
  await page.setViewportSize({ width: 1440, height: 480 });
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  await page.getByTestId("viewer-settings").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => (await dialog.boundingBox())?.y, "the dialog's top")
    .toBeLessThan(48);
  // A focus change in the dialog checks the bar again. Only a check that
  // starts after the dialog shows proves what it does to the bar.
  const before = await hitTests();
  await page.keyboard.press("Tab");
  await expect
    .poll(hitTests, "a check runs with the dialog open")
    .toBeGreaterThan(before);
  await expectSlots(page, expectMovesWindow, "under the dialog");
});

test("a browser checks no drag area, and the Mac window checks them only while it reports its buttons", async ({
  page,
}) => {
  const hitTests = await countHitTests(page);
  const made = await publishedProject(page, "mac-window-covered-browser");
  await page.setViewportSize(zoomedNarrowWindow);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  // A browser reports no buttons. A cover, a change of the page, a focus
  // change and a resize ask for no check, so no part stops moving the window.
  await page.getByRole("button", { name: "Search catalogue" }).click();
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await expect(search).toBeFocused();
  await page.setViewportSize(resizedNarrowWindow);
  await drawnTwice(page);
  // The count only grows, so one read after the frames covers the whole run.
  expect(await hitTests(), "the hit tests in a browser").toBe(0);
  await expectSlots(
    page,
    expectMovesWindow,
    "under the open search in a browser",
    "compact",
  );

  // The window reports its buttons as it leaves full screen, which resizes
  // it. The check starts, and the open search turns off the slots.
  await emulateMacWindow(page, "start");
  await page.setViewportSize(zoomedNarrowWindow);
  await expectSlots(
    page,
    expectStopsMovingWindow,
    "under the open search",
    "compact",
  );
  await expect.poll(hitTests, "the hit tests of the check").toBeGreaterThan(0);

  // In full screen the window reports no buttons. The check stops, and every
  // slot moves the window again, with the search still open.
  await clearMacWindow(page);
  await page.setViewportSize(resizedNarrowWindow);
  await expect(search).toBeVisible();
  await expectSlots(
    page,
    expectMovesWindow,
    "under the open search in full screen",
    "compact",
  );
});
