import type { Page } from "@playwright/test";

/**
 * Keep every address each later document takes, in order: the one it loaded
 * with, then one entry per history write.
 *
 * The log lives in the page, beside the writes it records, so what it reports
 * does not depend on when a test looks. A check of the visible URL only sees
 * the moment it lands in, and an address that holds a credential for a single
 * render is clean again by the time a slower check arrives.
 */
export async function recordAddresses(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = [window.location.href];
    for (const operation of ["pushState", "replaceState"] as const) {
      const write = window.history[operation].bind(window.history);
      window.history[operation] = (
        ...given: Parameters<History["pushState"]>
      ) => {
        write(...given);
        log.push(window.location.href);
      };
    }
    Object.defineProperty(window, "__mkcAddresses", { value: log });
  });
}

/** Every address the current document has taken since it loaded. */
export async function recordedAddresses(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __mkcAddresses?: string[] }).__mkcAddresses ?? [],
  );
}
