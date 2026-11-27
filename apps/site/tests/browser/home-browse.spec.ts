import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

/**
 * Frame 01 Browse of the home: the depicted Mokly viewer's compare toolbar,
 * the frame as a depiction, and its demo, which plays once in view and
 * rests with the Swipe divider at the middle of the compared screens, and
 * the reader's pointer, which pauses the sweep and grabs the divider. The
 * home spec checks the module's place in the features, and the home island
 * test checks when the island arms and plays a demo.
 *
 * The frame is hidden from assistive technology and its parts have no
 * role, so these checks find the drawn parts by their text, and the stage
 * and the divider, which carry no text, by their class names.
 */

/** The product's compare modes, in the order of the comparison panes. */
const MODES = ["Current", "Side by side", "Overlay", "Difference", "Swipe"];

/** The Browse module, named by its heading. */
function browseModule(page: Page): Locator {
  return page.getByRole("article", {
    name: "A visual diff for every branch.",
  });
}

/**
 * The Swipe divider's distance from the middle of the compared screens, in
 * CSS pixels, or NaN before the stage is laid out.
 */
async function dividerOffset(browse: Locator): Promise<number> {
  const [divider, stage] = await Promise.all([
    browse.locator(".site-home-swipe").boundingBox(),
    browse.locator(".site-stage-frame").boundingBox(),
  ]);
  if (divider === null || stage === null) return Number.NaN;
  return divider.x + divider.width / 2 - (stage.x + stage.width / 2);
}

/** Scroll the compared screens to 300px under the window's top. */
async function scrollToStage(page: Page, browse: Locator): Promise<void> {
  const box = await browse.locator(".site-stage-frame").boundingBox();
  const { width, height } = page.viewportSize() ?? { width: 390, height: 900 };
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, (box?.y ?? 0) - 300);
}

test(
  "the compare toolbar draws the product's five modes in order with Swipe chosen",
  { tag: "@scheme" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const browse = browseModule(page);
    const modes = MODES.map((mode) => browse.getByText(mode, { exact: true }));
    const lefts: number[] = [];
    for (const mode of modes) {
      await expect(mode).toBeVisible();
      lefts.push((await mode.boundingBox())?.x ?? Number.NaN);
    }
    expect(lefts).toEqual([...lefts].sort((left, right) => left - right));
    // The chosen mode is drawn raised on the surface; the others sit on the
    // toolbar's tone.
    for (const [index, mode] of modes.entries()) {
      const chosen = MODES[index] === "Swipe";
      await expect(mode, MODES[index]).toHaveCSS(
        "background-color",
        chosen ? /^rgb\(/ : "rgba(0, 0, 0, 0)",
      );
    }
  },
);

test("the Browse frame is hidden from assistive technology and takes no focus", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const browse = browseModule(page);
  await expect(browse).toMatchAriaSnapshot(`
    - article "A visual diff for every branch.":
      - /children: equal
      - paragraph: 01 Browse
      - heading "A visual diff for every branch." [level=3]
      - paragraph: Each branch and pull request publishes a catalogue built from your real components. Changes shows what moved, and the check on the pull request counts it.
  `);
  // From the hero's last action, the focus passes the Specs panel's seven
  // rows on a desktop, then leaves the features for the open foundation.
  await page
    .getByRole("main")
    .getByRole("link", { name: "Download for Mac" })
    .focus();
  for (let tab = 1; tab <= 9; tab++) {
    await page.keyboard.press("Tab");
    await expect(browse.locator(":focus"), `Tab ${tab}`).toHaveCount(0);
  }
});

/** The compared screens' box, once the stage is laid out. */
async function stageBox(browse: Locator): Promise<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}> {
  const box = await browse.locator(".site-stage-frame").boundingBox();
  if (box === null) throw new Error("The compared screens have no box");
  return box;
}

test(
  "a pointer that moves over the compared screens pauses the sweep until it leaves",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const browse = browseModule(page);
    await scrollToStage(page, browse);
    const poll = { intervals: [100], timeout: 10_000 };
    await expect.poll(() => dividerOffset(browse), poll).toBeLessThan(-40);

    const stage = await stageBox(browse);
    const track = browse.locator(".site-home-swipe-track");
    await page.mouse.move(stage.x + stage.width * 0.6, stage.y + 40);
    await expect(track).toHaveCSS("animation-play-state", "paused");
    await expect(browse.locator(".site-home-swipe-branch")).toHaveCSS(
      "animation-play-state",
      "paused",
    );
    expect(await dividerOffset(browse)).toBeLessThan(-1);

    // Off the screens, the sweep plays on and rests at the middle.
    await page.mouse.move(stage.x + stage.width * 0.6, stage.y - 60);
    await expect(track).toHaveCSS("animation-play-state", "running");
    await expect.poll(() => dividerOffset(browse), poll).toBeGreaterThan(40);
    await expect
      .poll(async () => Math.abs(await dividerOffset(browse)), poll)
      .toBeLessThanOrEqual(1);
  },
);

test(
  "a grab slides the divider, which stays where the pointer leaves it",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const browse = browseModule(page);
    await scrollToStage(page, browse);
    const poll = { intervals: [100], timeout: 10_000 };
    await expect.poll(() => dividerOffset(browse), poll).toBeLessThan(-40);

    const stage = await stageBox(browse);
    const y = stage.y + 40;
    await page.mouse.move(stage.x + stage.width * 0.7, y);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.8, y);
    // At 80% of the stage's width, the divider is 30% right of the middle.
    const slid = async (): Promise<number> =>
      Math.abs((await dividerOffset(browse)) - stage.width * 0.3);
    await expect.poll(slid).toBeLessThanOrEqual(1);
    await page.mouse.up();

    // Off the screens, the sweep stays off and the divider stays put.
    await page.mouse.move(stage.x + stage.width * 0.8, stage.y - 60);
    for (const part of [".site-home-swipe-track", ".site-home-swipe-branch"]) {
      await expect(browse.locator(part), part).toHaveCSS(
        "animation-name",
        "none",
      );
    }
    await expect(browse.locator(".site-home-swipe-branch")).toHaveCSS(
      "clip-path",
      "inset(0px 0px 0px 80%)",
    );
    expect(await slid()).toBeLessThanOrEqual(1);
  },
);

test("under reduced motion the Browse demo rests in its finished state at once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(SITE_PATHS.home);
  const browse = browseModule(page);
  await scrollToStage(page, browse);
  // The connector of this width is drawn, which a waiting demo hides, and
  // the divider rests at the middle.
  const connector = browse
    .locator(".site-home-connector, .site-home-fit-connector")
    .filter({ visible: true });
  await expect(connector).toHaveCSS("clip-path", "none");
  await expect
    .poll(async () => Math.abs(await dividerOffset(browse)))
    .toBeLessThanOrEqual(1);
});
