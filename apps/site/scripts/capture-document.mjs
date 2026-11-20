/** The inspection viewport height used between route captures. */
const INSPECTION_HEIGHT = 900;

/**
 * Capture one complete document through a viewport tall enough to contain it.
 * Chromium's full-page capture path can omit a transformed, sandboxed iframe;
 * a normal viewport capture keeps that frame in the composed surface.
 *
 * @param {Pick<import("@playwright/test").Page, "evaluate" | "screenshot" | "setViewportSize">} page
 * @param {number} width
 * @param {string} file
 */
export async function captureDocument(page, width, file) {
  const height = await page.evaluate(() =>
    Math.ceil(globalThis.document.documentElement.scrollHeight),
  );
  await page.setViewportSize({ height, width });
  try {
    await page.screenshot({ path: file });
  } finally {
    await page.setViewportSize({ height: INSPECTION_HEIGHT, width });
  }
}
