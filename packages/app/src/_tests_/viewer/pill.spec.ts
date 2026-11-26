import type { Locator, Page } from "@playwright/test";

import { expect, open, test } from "../harness";

import { makePublic, publishedProject, publishedViewerReady } from "./support";

/*
 * The publication pill is one control. A press anywhere on it opens the
 * switcher, its decorative parts and its hairline included, it draws its
 * branch in regular mono, and a hovering pointer darkens it. A squeezed pill
 * keeps its whole name, which `mac-window/switch-width.spec.ts` checks at the
 * switch width.
 */

/** Press the middle of one part of the pill, as a pointer does. */
async function pressMiddle(page: Page, part: Locator): Promise<void> {
  const box = await part.boundingBox();
  expect(box, "the part is drawn").not.toBeNull();
  if (box === null) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** A press opens the switcher; closing it leaves the bar as it was. */
async function expectOpensSwitcher(
  page: Page,
  part: string,
  press: () => Promise<void>,
): Promise<void> {
  const panel = page.getByTestId("viewer-panel-switcher");
  await press();
  await expect(
    panel,
    `a press on the ${part} opens the switcher`,
  ).toBeVisible();
  await page.getByTestId("close-switcher").click();
  await expect(panel).toHaveCount(0);
}

test("the pill darkens under a hovering pointer, draws its branch in mono, and a press anywhere on it opens the switcher", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-pill");
  // A public catalogue needs no credential, so the page asks for no grant.
  let grants = 0;
  await page.route("**/access-grants", (route) => {
    grants += 1;
    return route.continue();
  });
  await makePublic(page, made.projectId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, made.publicationPath);

  await test.step("a public publication asks for no grant at all", async () => {
    await expect(page.getByTestId("viewer-share")).toBeEnabled();
    expect(grants, "a public catalogue needs no credential").toBe(0);
  });
  await publishedViewerReady(page);

  await test.step("a hovering pointer darkens the pill's fill and hairline, and a press darkens the fill more", async () => {
    const viewer = page.locator("[data-mokly-shell]");
    const pill = viewer.locator(".fo-canvas-pill");
    const control = viewer.getByTestId("viewer-publication");
    // The stronger line of the pill's divider, which the hovered hairline takes.
    const strongLine = await pill
      .locator(".fo-canvas-pill-rule")
      .evaluate((rule) => getComputedStyle(rule).backgroundColor);
    // At rest the Button draws no fill, and the frame keeps its light hairline,
    // the Canvas `border`.
    await expect(control).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(pill).toHaveCSS("border-top-color", "rgb(225, 228, 222)");
    expect(strongLine).not.toBe("rgb(225, 228, 222)");

    // The Canvas ink at 5% over `surfaceMuted` while a pointer hovers it, and
    // at 7% while the pointer presses it.
    await control.hover();
    await expect(control).toHaveCSS("background-color", "rgb(235, 237, 234)");
    await expect(pill).toHaveCSS("border-top-color", strongLine);
    await page.mouse.down();
    await expect(control).toHaveCSS("background-color", "rgb(231, 232, 229)");
    await page.mouse.up();
    await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
    await page.getByTestId("close-switcher").click();
    await expect(page.getByTestId("viewer-panel-switcher")).toHaveCount(0);

    // Away from the pill, it rests again.
    await page.mouse.move(8, 450);
    await expect(control).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(pill).toHaveCSS("border-top-color", "rgb(225, 228, 222)");
  });

  await test.step("the pill draws its branch in mono, and a press anywhere on it opens the switcher", async () => {
    const viewer = page.locator("[data-mokly-shell]");
    // The pill the reader sees: its frame, whatever it holds.
    const pill = viewer.locator(".fo-canvas-pill");
    // The branch reads in regular mono, as a reference does.
    const branch = pill.locator(".fo-canvas-pill-branch");
    await expect(branch).toHaveText("main");
    await expect(branch).toHaveCSS("font-family", /^"Geist Mono"/);
    await expect(branch).toHaveCSS("font-weight", "400");
    // The full pill at this width draws every part, its short SHA too.
    await expect(pill.locator(".mono-value")).toBeVisible();
    for (const [part, selector] of [
      ["glyph", ".fo-canvas-pill-glyph"],
      ["branch", ".fo-canvas-pill-branch"],
      ["divider", ".fo-canvas-pill-rule"],
      ["state's dot", '.fo-top-state > [aria-hidden="true"]'],
      ["state's phrase", ".fo-top-state-detail"],
      ["short SHA", ".mono-value"],
      ["chevron", ".fo-canvas-pill-chevron"],
    ] as const)
      await expectOpensSwitcher(page, "pill's " + part, () =>
        pressMiddle(page, pill.locator(selector)),
      );
    // The pill's hairline is part of the control.
    await expectOpensSwitcher(page, "pill's hairline", async () => {
      const box = await pill.boundingBox();
      expect(box, "the pill is drawn").not.toBeNull();
      if (box !== null)
        await page.mouse.click(box.x + 0.5, box.y + box.height / 2);
    });

    // The compact pill draws its dot and its chevron beside the reference.
    await page
      .locator('[data-mkc-screen="viewer"]')
      .evaluate((element) => (element.style.width = "768px"));
    await expect(viewer.getByTestId("viewer-more")).toBeVisible();
    for (const [part, selector] of [
      ["dot", ".fo-canvas-pill-dot"],
      ["chevron", ".fo-canvas-pill-chevron"],
    ] as const)
      await expectOpensSwitcher(page, "compact pill's " + part, () =>
        pressMiddle(page, pill.locator(selector).filter({ visible: true })),
      );
  });
});
