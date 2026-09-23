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
/** Assert the actual immediate document, including history-replacing frame swaps. */
export async function expectFramePath(
  page: Page,
  selector: string,
  path: RegExp,
): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator(selector)
        .evaluate(
          (frame: HTMLIFrameElement) =>
            frame.contentWindow?.location.href ?? "",
        ),
    )
    .toMatch(path);
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
