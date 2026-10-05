import { expect, test, type Page } from "@playwright/test";

import { interactiveShellFixture } from "./interactive_shell_fixture.js";
import {
  holdEvidence,
  previewMode,
  toolbarPlacement,
  watchToolbarPlacement,
} from "./interactive_shell_helpers.js";

type Fixture = Awaited<ReturnType<typeof interactiveShellFixture>>;

let fixture: Fixture;
let staticOnly: Fixture;

test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(async () => {
  [fixture, staticOnly] = await Promise.all([
    interactiveShellFixture(),
    interactiveShellFixture("off"),
  ]);
  fixture.gate.open();
});

test.afterAll(async () => {
  await Promise.all([fixture?.close(), staticOnly?.close()]);
});

async function open(
  page: Page,
  url: string,
  route: string,
  heading: string,
): Promise<void> {
  await page.goto(`${url}/view/${route.replace(/index\.html$/, "")}`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
  await expect(page.locator("#mb-main h2")).toHaveText(heading);
}

/**
 * Follow one catalogue row from the narrow navigation drawer while that
 * route's private evidence is held. The returned log starts before the click,
 * so it records every toolbar move the navigation causes.
 */
async function navigateHeld(page: Page, route: string, heading: string) {
  const held = await holdEvidence(page, route);
  const placements = await watchToolbarPlacement(page);
  await page.locator("[data-mokly-menu]").click();
  await page.locator(`a[data-nav-row][data-route="${route}"]`).click();
  await held.requested;
  await expect(page.locator("#mb-main h2")).toHaveText(heading);
  await page.waitForTimeout(250);
  return { placements, release: held.release };
}

test("at narrow widths only a toolbar with Static and Live takes its own row", async ({
  page,
}) => {
  for (const [route, heading, offered] of [
    ["home/index.html", "Home", true],
    ["counter/index.html", "Counter", true],
    ["notes/index.html", "Notes", false],
    ["badge/index.html", "Badge", false],
  ] as const) {
    await open(page, fixture.url, route, heading);
    expect(await toolbarPlacement(page), route).toEqual(
      offered ? [true, "row"] : [false, "beside"],
    );
  }

  await open(page, fixture.url, "details/index.html", "Details");
  expect(await toolbarPlacement(page)).toEqual([true, "row"]);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(previewMode(page)).toHaveCount(0);
  expect(await toolbarPlacement(page)).toEqual([false, "beside"]);
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(previewMode(page)).toHaveCount(1);
  expect(await toolbarPlacement(page)).toEqual([true, "row"]);
});

test("a static-only catalogue keeps its narrow toolbar beside the title", async ({
  page,
}) => {
  for (const [route, heading] of [
    ["home/index.html", "Home"],
    ["counter/index.html", "Counter"],
  ] as const) {
    await open(page, staticOnly.url, route, heading);
    expect(await toolbarPlacement(page), route).toEqual([false, "beside"]);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await toolbarPlacement(page),
    "a title that leaves no room wraps the toolbar from the heading's start",
  ).toEqual([false, "row"]);
});

test("a narrow toolbar moves at most once per navigation, with its control", async ({
  page,
}) => {
  await open(page, fixture.url, "home/index.html", "Home");

  const notes = await navigateHeld(page, "notes/index.html", "Notes");
  expect(await notes.placements()).toEqual([[true, "row"]]);
  notes.release();
  await expect(previewMode(page)).toHaveCount(0);
  expect(await notes.placements()).toEqual([
    [true, "row"],
    [false, "beside"],
  ]);

  const counter = await navigateHeld(page, "counter/index.html", "Counter");
  expect(await counter.placements()).toEqual([[false, "beside"]]);
  counter.release();
  await expect(previewMode(page)).toHaveCount(1);
  expect(await counter.placements()).toEqual([
    [false, "beside"],
    [true, "row"],
  ]);

  const home = await navigateHeld(page, "home/index.html", "Home");
  home.release();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page.waitForTimeout(500);
  expect(await home.placements()).toEqual([[true, "row"]]);
});
