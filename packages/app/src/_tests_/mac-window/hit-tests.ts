import type { Page } from "@playwright/test";

/** The property of the page's window that reports the count. */
const counter = "mkcHitTests";

/**
 * Count the hit tests of each page, the calls of `document.elementFromPoint`,
 * from the page's first script on. Only the app's check of the Mac window's
 * drag areas tests points on the screens of these tests, so a count that
 * grows shows that a check ran. The returned function reads the count of the
 * page that shows now, or -1 when the counter is missing.
 */
export async function countHitTests(
  page: Page,
): Promise<() => Promise<number>> {
  await page.addInitScript((name) => {
    if (window !== window.top) return;
    const test = Document.prototype.elementFromPoint;
    let count = 0;
    Document.prototype.elementFromPoint = function (x, y) {
      count += 1;
      return test.call(this, x, y);
    };
    Object.defineProperty(window, name, { get: () => count });
  }, counter);
  return () =>
    page.evaluate((name) => {
      const count: unknown = Reflect.get(window, name);
      return typeof count === "number" ? count : -1;
    }, counter);
}

/**
 * Wait until the page has drawn two more frames, so that each check that a
 * change asked for before the wait has run.
 */
export async function drawnTwice(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}
