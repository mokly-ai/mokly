import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Choose an appearance. A standalone document has one Appearance control that
 * sets the interface and the previews together; an embedded root keeps its own
 * preview switch, so both are supported here.
 */
export async function chooseScheme(
  page: Page,
  value: "light" | "dark",
): Promise<void> {
  await expect(
    page
      .locator(
        "[data-mokly-appearance-select]:visible, [data-workspace-scheme]:visible, [data-color-scheme-option]:visible",
      )
      .first(),
  ).toBeVisible();
  const appearance = page.locator("[data-mokly-appearance-select]");
  if (await appearance.count()) {
    await appearance.selectOption(value);
    return;
  }
  const toggle = page.locator("[data-workspace-scheme]");
  if (await toggle.count()) {
    if (
      (await toggle.getAttribute("aria-pressed")) !== String(value === "dark")
    )
      await toggle.click();
  } else
    await page.locator(`[data-color-scheme-option="${value}"]:visible`).click();
}
export async function chooseViewport(
  page: Page,
  value: "mobile" | "desktop" | "both",
): Promise<void> {
  await page.getByLabel("Viewport", { exact: true }).selectOption(value);
}
/** Navigate through the workspace's entry-backed saved-variant bar. */
export async function chooseVariant(page: Page, title: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Saved variants" })
    .getByRole("link", { name: title, exact: true })
    .click();
}
export async function expectFrameSource(
  frame: Locator,
  source: RegExp | string,
): Promise<void> {
  const value = () =>
    frame.evaluate((element: HTMLIFrameElement) => {
      try {
        return element.contentWindow?.location.href ?? element.src;
      } catch {
        return element.src;
      }
    });
  if (typeof source === "string") await expect.poll(value).toBe(source);
  else await expect.poll(value).toMatch(source);
}

/**
 * The selector of one canvas frame of the routed screen or component, by its
 * viewport and its own scheme: from 900px wide, a screen shows Desktop beside
 * Mobile in Light and Dark, and a component its rows of desktop frames.
 */
export function canvasFrame(
  viewport: "desktop" | "mobile",
  scheme: "dark" | "light" = "light",
): string {
  return `iframe[data-workspace-frame="${viewport}"][data-workspace-color-scheme="${scheme}"]`;
}

/**
 * The selector of a viewport's frame in either layout: the canvas's Light
 * frame from 900px wide, or below it the one frame of the viewport, which
 * shows the preview scheme.
 */
export function viewportFrame(viewport: "desktop" | "mobile"): string {
  return `iframe[data-workspace-frame="${viewport}"]:not([data-workspace-color-scheme="dark"])`;
}

/**
 * Expect the canvas to keep a chosen viewport: the Viewport control holds it,
 * its column of frames shows, and the other column stays hidden.
 */
export async function expectCanvasViewport(
  page: Page,
  viewport: "desktop" | "mobile",
): Promise<void> {
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    viewport,
  );
  await expect(page.locator(canvasFrame(viewport))).toBeVisible();
  await expect(
    page.locator(canvasFrame(viewport === "desktop" ? "mobile" : "desktop")),
  ).toBeHidden();
}

/**
 * The selector of the routed page's or Markdown document's frame: the
 * canvas's reading frame from 900px wide, and the document pane's frame below.
 */
export const DOCUMENT_FRAME =
  "[data-mokly-stage] iframe, .mbk-stage-embed iframe";

/**
 * A window narrower than the 900px layout breakpoint, where the one-frame
 * stage shows each screen view in the preview scheme, in device chrome.
 */
export const NARROW_WINDOW = { width: 860, height: 800 } as const;

/** Wait for the matching same-origin document and its blocking resources together. */
export async function expectFrameLoaded(
  frame: Locator,
  source: RegExp | string,
): Promise<void> {
  await expect
    .poll(() =>
      frame.evaluate((element: HTMLIFrameElement) => {
        const doc = element.contentDocument;
        return doc ? { url: doc.URL, readyState: doc.readyState } : null;
      }),
    )
    .toEqual({
      url: typeof source === "string" ? source : expect.stringMatching(source),
      readyState: "complete",
    });
}
