import type { Locator, Page } from "@playwright/test";

import { expect } from "../harness";

import { expectMovesWindow } from "./regions";

/** The height of every top bar, and of the top row that the window keeps. */
const topRow = 48;

/**
 * Turn the mouse wheel until the page reaches one of its ends, as a reader
 * does. The wheel turns at the window's left edge, over the page's own
 * margin, so no scrolling box inside the page takes it.
 */
async function wheelTo(page: Page, end: "start" | "end") {
  const size = page.viewportSize();
  if (size === null) throw new Error("the page has no window size");
  await page.mouse.move(4, size.height / 2);
  await page.mouse.wheel(0, end === "end" ? 10_000 : -10_000);
  await expect
    .poll(
      () =>
        page.evaluate(
          (to) =>
            Math.round(
              to === "end"
                ? document.documentElement.scrollHeight - innerHeight - scrollY
                : scrollY,
            ),
          end,
        ),
      `the page scrolls to its ${end}`,
    )
    .toBe(0);
}

/** Scroll the page to its end, and return how far it scrolled. */
export async function scrollToEnd(page: Page): Promise<number> {
  await wheelTo(page, "end");
  return page.evaluate(() => scrollY);
}

/** Scroll the page back to its start. */
export async function scrollToStart(page: Page) {
  await wheelTo(page, "start");
}

/** Where the top of an element is in the window, to the pixel. */
async function topOf(element: Locator): Promise<number | undefined> {
  const box = await element.boundingBox();
  return box === null ? undefined : Math.round(box.y);
}

/**
 * The part stays at the top of the window over the scrolled page, it still
 * moves the window, and nothing beneath it shows through it, under the window
 * buttons or elsewhere. `beneath` is content that the page has scrolled under
 * the part.
 */
export async function expectStaysOver(
  page: Page,
  part: Locator,
  beneath: Locator,
  label: string,
) {
  await expect
    .poll(() => topOf(part), `${label} stays at the top of the window`)
    .toBe(0);
  await expectMovesWindow(part, label);
  const box = await part.boundingBox();
  const under = await beneath.boundingBox();
  if (box === null || under === null) {
    throw new Error(`${label} or the content beneath it has no box`);
  }
  // Without content under the part, the comparison below proves nothing.
  expect(under.y, `content starts under ${label}`).toBeLessThan(box.height);
  expect(under.y + under.height, `content ends below ${label}`).toBeGreaterThan(
    box.height,
  );
  const shot = () =>
    page.screenshot({ clip: box, animations: "disabled", caret: "hide" });
  const covered = await shot();
  // A reader cannot take the content away. Hiding it shows what the part
  // draws by itself, which is all that the part may show. A role locator no
  // longer finds hidden content, so one handle hides it and shows it again.
  const content = await beneath.elementHandle();
  await content.evaluate((element: HTMLElement) => {
    element.style.visibility = "hidden";
  });
  const alone = await shot();
  await content.evaluate((element: HTMLElement) => {
    element.style.visibility = "";
  });
  await content.dispose();
  expect(
    covered.equals(alone),
    `${label} hides the content that scrolls under it`,
  ).toBe(true);
}

/**
 * Keyboard focus that moves back to a control which the page has scrolled
 * under the top row brings the control out from under it. `next` is the
 * control after it in the tab order.
 */
export async function expectFocusClearOfTopRow(
  page: Page,
  control: Locator,
  next: Locator,
  label: string,
) {
  await expect
    .poll(() => topOf(control), `${label} starts under the top row`)
    .toBeLessThan(topRow);
  await next.click();
  await page.keyboard.press("Shift+Tab");
  await expect(control, `${label} takes focus`).toBeFocused();
  await expect
    .poll(() => topOf(control), `${label} sits clear of the top row`)
    .toBe(topRow);
}
