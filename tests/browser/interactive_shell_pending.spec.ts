import { expect, test, type Page } from "@playwright/test";

import { interactiveShellFixture } from "./interactive_shell_fixture.js";
import {
  expectLive,
  expectLiveReady,
  expectStaticFrames,
  holdEvidence,
  liveFrame,
  previewMode,
  recordLiveRequests,
  watchPreviewModePresence,
} from "./interactive_shell_helpers.js";

let fixture: Awaited<ReturnType<typeof interactiveShellFixture>>;

test.beforeAll(async () => {
  fixture = await interactiveShellFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${fixture.url}/view/${route.replace(/index\.html$/, "")}`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
}

/**
 * Navigate while the destination's private evidence is held, and return once
 * the shell has asked for it, so every effect of the new route has run.
 */
async function navigateHeld(page: Page, route: string, heading: string) {
  const held = await holdEvidence(page, route);
  const presence = await watchPreviewModePresence(page);
  await page.locator(`a[data-nav-row][data-route="${route}"]`).click();
  await held.requested;
  await expect(page.locator("#mb-main h2")).toHaveText(heading);
  await page.waitForTimeout(250);
  return { presence, release: held.release };
}

async function expectPreparing(page: Page): Promise<void> {
  await expect(page.locator(".mbk-live-preparing")).toHaveCount(2);
  await expect(page.locator(".mbk-live-frame iframe")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
}

test("a view waiting for its eligibility never prepares or mounts Live, and its control changes at most once", async ({
  page,
}) => {
  const seen = recordLiveRequests(page, fixture.liveOrigin!);
  await open(page, "home/index.html");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expect.poll(() => seen.preparations).toBe(1);
  await expectPreparing(page);

  const details = await navigateHeld(page, "details/index.html", "Details");
  await expectLive(page);
  await expectPreparing(page);
  expect(seen.preparations).toBe(1);
  details.release();
  await expect.poll(() => seen.preparations).toBe(2);
  expect(await details.presence()).toEqual([true]);

  const notes = await navigateHeld(page, "notes/index.html", "Notes");
  await expectLive(page);
  await expectPreparing(page);
  notes.release();
  await expect(previewMode(page)).toHaveCount(0);
  await expectStaticFrames(page);
  expect(seen.preparations).toBe(2);
  expect(await notes.presence()).toEqual([true, false]);

  const counter = await navigateHeld(page, "counter/index.html", "Counter");
  await expect(previewMode(page)).toHaveCount(0);
  await expectStaticFrames(page);
  expect(seen.preparations).toBe(2);
  counter.release();
  await expectLive(page);
  await expect.poll(() => seen.preparations).toBe(3);
  expect(await counter.presence()).toEqual([false, true]);

  fixture.gate.open();
  await expectLiveReady(page);
  const home = await navigateHeld(page, "home/index.html", "Home");
  await expectLive(page);
  await expectPreparing(page);
  expect(seen.documents.filter((path) => path.includes("home"))).toEqual([]);
  home.release();
  await expectLiveReady(page);
  await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
    "Home: 0",
  );
  expect(await home.presence()).toEqual([true]);
  expect(seen.documents.filter((path) => path.includes("notes"))).toEqual([]);
  expect(seen.preparations).toBe(3);
});
