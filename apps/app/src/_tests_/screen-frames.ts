import type { Page } from "@playwright/test";

/** What one frame of a document drew: its heading and whether it waited. */
export interface ScreenFrame {
  heading: string | null;
  waiting: boolean;
}

/**
 * Keep every frame each later document draws, in order: its heading and
 * whether a region of it waits, each time either changes.
 *
 * The log lives in the page, beside the changes it records, so what it
 * reports does not depend on when a test looks. A wait that lasts until the
 * next effect, such as the session guard's while it redirects, is gone again
 * by the time a later check could see it.
 */
export async function recordFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const frames: { heading: string | null; waiting: boolean }[] = [];
    new MutationObserver(() => {
      const frame = {
        heading: document.querySelector("h1")?.textContent ?? null,
        waiting: document.querySelector('[aria-busy="true"]') !== null,
      };
      const last = frames.at(-1);
      if (last?.heading !== frame.heading || last.waiting !== frame.waiting)
        frames.push(frame);
    }).observe(document, { attributes: true, childList: true, subtree: true });
    Object.defineProperty(window, "__mkcFrames", { value: frames });
  });
}

/** Every frame the current document has drawn since it loaded. */
export async function recordedFrames(page: Page): Promise<ScreenFrame[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __mkcFrames?: ScreenFrame[] }).__mkcFrames ?? [],
  );
}
