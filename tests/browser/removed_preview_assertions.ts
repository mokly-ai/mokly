import { type Frame, type Page } from "@playwright/test";

export const stage = "[data-mokly-preview]";

export const previewFrame = `${stage} iframe`;

/** The viewer-owned historical document behind the preview frame element. */
export async function historical(page: Page): Promise<Frame> {
  const handle = await page.locator(previewFrame).elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("Historical preview frame was unavailable");
  return frame;
}

/**
 * Report whether the browser has finished with a matching request, whether it
 * was delivered or cancelled. A fenced preview request settles either way, so
 * this replaces waiting on the clock for the response a navigation left behind.
 */
export function settlement(page: Page, match: string): () => boolean {
  let done = false;
  const settle = (request: { url(): string }): void => {
    if (request.url().includes(match)) done = true;
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return () => done;
}

/** Every top-level document the browser asked for, in order. */
export function documentRequests(page: Page): readonly string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") requested.push(request.url());
  });
  return requested;
}
