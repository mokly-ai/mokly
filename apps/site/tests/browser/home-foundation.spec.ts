import { type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

/** The open foundation that closes the home, by its heading. */
function foundation(page: Page) {
  return page.getByRole("region", {
    name: "Your screens. Your building blocks.",
  });
}

/**
 * The frame labelled Open foundation and the wires that it draws. The frame
 * is a depiction, hidden from assistive technology, so no role finds it.
 */
function frame(page: Page) {
  return foundation(page).locator(".site-home-source");
}

/** The wire that the 1440px composition draws across the frame. */
function wideWire(page: Page) {
  return frame(page).locator(".site-home-wire");
}

/**
 * The clip of the 1440px wire while the demo waits: shut just before the dot
 * on the code, measured from the frame's right edge. Once drawn, the wire
 * rests unclipped, as the built page draws it.
 */
const WAITING = "inset(0px 387px 0px 0px)";

test("the open foundation reads as its copy, its actions, its facts and its steps", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  // The frame, its code, its artboard and its wires are depictions: none of
  // them reaches assistive technology, so the section reads as its copy.
  await expect(foundation(page)).toMatchAriaSnapshot(`
    - /children: deep-equal
    - paragraph: An open foundation
    - heading "Your screens. Your building blocks." [level=2]
    - paragraph: Author locally with the open-source Mokly CLI. Keep your screens in Git and host the catalogue anywhere. The cloud adds hosting, review and the agent; it never owns the source.
    - link "Get started"
    - link "View on GitHub"
    - list:
      - listitem: "@mokly/mokly"
      - listitem: MIT license
      - listitem: The CLI runs locally
      - listitem: Host the catalogue anywhere
    - list:
      - listitem:
        - text: "01"
        - heading "Shape the next screen." [level=3]
        - paragraph: Author with React and your shared components.
      - listitem:
        - text: "02"
        - heading "Publish the branch." [level=3]
        - paragraph: Open the pull request check to review the screens that changed.
      - listitem:
        - text: "03"
        - heading "Build from a shared decision." [level=3]
        - paragraph: Keep comments and approvals with the pull request.
  `);
  const steps = foundation(page)
    .getByRole("list")
    .filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(steps).toHaveJSProperty("tagName", "OL");
});

test("nothing in the open-foundation frame takes focus", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  // The frame draws its label, and then the facts and the steps follow it;
  // from the last action, the next stop is the footer's first link.
  await expect(
    foundation(page).getByText("Open foundation", { exact: true }),
  ).toBeVisible();
  await foundation(page).getByRole("link", { name: "View on GitHub" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Mokly home" }),
  ).toBeFocused();
});

test("the wire shows on desktop and leaves below 960px @desktop", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const wires = frame(page).locator(".site-home-wire, .site-home-fit-wire");
  // From 1440px the wide wire spans the frame, below it the wire of each
  // artboard width hangs at the frame's right edge, and below 960px the
  // artboard follows the code with no wire.
  for (const [width, shown] of [
    [1440, 1],
    [1439, 1],
    [1279, 1],
    [960, 1],
    [959, 0],
    [768, 0],
    [390, 0],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(wires.filter({ visible: true }), `${width}px`).toHaveCount(
      shown,
    );
  }
});

test("the demo waits out of view, plays in view and rests with the wire drawn @desktop", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  await expect(wideWire(page)).toHaveCSS("clip-path", WAITING);
  await frame(page).scrollIntoViewIfNeeded();
  await expect(wideWire(page)).toHaveCSS("clip-path", "none");
});

test("under reduced motion the demo rests with the wire drawn at once @desktop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(SITE_PATHS.home);
  await expect(wideWire(page)).toHaveCSS("clip-path", "none");
  await frame(page).scrollIntoViewIfNeeded();
  await expect(wideWire(page)).toHaveCSS("clip-path", "none");
});
