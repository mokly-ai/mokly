import type { Locator, Page } from "@playwright/test";

import { expect, open, test } from "../harness";
import { emulateMacWindow } from "../mac-window/regions";

import { makePublic, publishedProject, publishedViewerReady } from "./support";
import { macAgent, openWidestCentre, widestPull } from "./widest-centre";

/*
 * The publication pill is one control. A press anywhere on it opens the
 * switcher, its decorative parts and its hairline included, it draws its
 * branch in regular mono, a hovering pointer darkens it, and a squeezed pill
 * keeps its whole name.
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

test("the pill draws its branch in mono, and a press anywhere on it opens the switcher", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-pill-press");
  await makePublic(page, made.projectId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
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

test("a hovering pointer darkens the pill's fill and hairline, and a press darkens the fill more", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-pill-hover");
  await makePublic(page, made.projectId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
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

test.describe("on a Mac", () => {
  test.use({ userAgent: macAgent });

  test("squeezed by the widest centre beside the window buttons, the pill keeps its whole name and tooltip", async ({
    page,
  }) => {
    const { viewer, head } = await openWidestCentre(
      page,
      "viewer-pill-widest-name",
    );
    await emulateMacWindow(page, "start");
    const pill = viewer.locator(".fo-package-slot-center .fo-canvas-pill");
    // At a 1022px window the pill keeps its glyph and the start of its
    // reference: it cuts the reference, and it draws neither the state's
    // phrase nor the short SHA.
    await expect
      .poll(
        () =>
          pill
            .locator(".fo-canvas-pill-name")
            .evaluate((name) => name.scrollWidth > name.clientWidth),
        "the reference is cut",
      )
      .toBe(true);
    await expect(pill.locator(".fo-top-state-detail")).toBeHidden();
    await expect(pill.locator(".mono-value")).toBeHidden();
    // The tooltip and the Button's name still give the whole reference, the
    // state's phrase and the short SHA, in the order the full pill shows them.
    const whole = new RegExp(
      `^#${widestPull.number} ${widestPull.title}, ${widestPull.author} · ` +
        `Ready · [^,]+, ${head.slice(0, 7)}$`,
    );
    await expect(pill).toHaveAttribute("title", whole);
    await expect(viewer.getByTestId("viewer-publication")).toHaveAccessibleName(
      whole,
    );
  });
});
