import { expect, type Page, type Route } from "@playwright/test";

/** Whether a routed request is the shell's evidence read for one page. */
export function isEvidenceRequest(route: Route, pathname: string): boolean {
  return (
    route.request().resourceType() === "fetch" &&
    new URL(route.request().url()).pathname === pathname
  );
}

/** A promise pair that records when a held request starts and releases it. */
export function latch() {
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { markRequested, release, requested, wait };
}

export async function expectHydrated(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
}

/** Flag any moment the Usage panel claims a validated empty consumer list. */
export async function recordFalseEmptyState(page: Page) {
  await page.evaluate(() => {
    const inspect = () => {
      if (document.body.textContent?.includes("No recorded consumers."))
        document.documentElement.dataset.sawFalseUsageEmpty = "";
    };
    new MutationObserver(inspect).observe(document.body, {
      childList: true,
      subtree: true,
    });
    inspect();
  });
}

export async function markDesktopFrame(page: Page) {
  await page.locator('[data-workspace-frame="desktop"]').evaluate((frame) => {
    frame.setAttribute("data-scope-frame-retained", "");
  });
}

export async function expectDesktopFrameRetained(page: Page) {
  await expect(
    page.locator(
      '[data-workspace-frame="desktop"][data-scope-frame-retained=""]',
    ),
  ).toHaveCount(1);
}
