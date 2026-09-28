import {
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

/** Shell copy for a view whose Live preview cannot run. */
export const UNAVAILABLE = "Live preview is unavailable for this view.";

/** The toolbar's Static/Live group. */
export function previewMode(page: Page): Locator {
  return page.getByRole("group", { name: "Preview mode" });
}

/** The mounted Live document for one viewport. */
export function liveFrame(
  page: Page,
  viewport: "desktop" | "mobile",
): FrameLocator {
  return page.frameLocator(`iframe[data-mokly-live-frame="${viewport}"]`);
}

/** Static is the selected segment. */
export async function expectStatic(page: Page): Promise<void> {
  const group = previewMode(page);
  await expect(group.getByRole("button", { name: "Static" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
}

/** Live is the selected segment. */
export async function expectLive(page: Page): Promise<void> {
  const group = previewMode(page);
  await expect(group.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Static" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
}

/** Wait until every visible workspace frame shows its mounted Live document. */
export async function expectLiveReady(page: Page, frames = 2): Promise<void> {
  await expect(
    page.locator('.mbk-live-frame[data-live-frame-state="ready"]'),
  ).toHaveCount(frames, { timeout: 30_000 });
  await expect(page.locator(".mbk-live-preparing")).toHaveCount(0);
}

/** Requests a page made for Live documents and for bundle preparation. */
export interface LiveRequests {
  documents: string[];
  preparations: number;
}

/** Record Live document paths on `liveOrigin` and preparation calls. */
export function recordLiveRequests(
  page: Page,
  liveOrigin: string,
): LiveRequests {
  const seen: LiveRequests = { documents: [], preparations: 0 };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === liveOrigin && url.pathname.startsWith("/static/"))
      seen.documents.push(url.pathname);
    if (/^\/__mokly\/interactive\/[a-f0-9]{32}\/prepare$/.test(url.pathname))
      seen.preparations += 1;
  });
  return seen;
}

/** A route's same-shell evidence request, held until `release()`. */
export interface HeldEvidence {
  /** Resolves once the shell has asked for the route's private evidence. */
  requested: Promise<void>;
  release(): void;
}

/** Hold the fetch that loads one route's private evidence after navigation. */
export async function holdEvidence(
  page: Page,
  route: string,
): Promise<HeldEvidence> {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  await page.route(`**/view/${route}`, async (intercepted) => {
    if (intercepted.request().resourceType() === "fetch") {
      markRequested();
      await released;
    }
    await intercepted.continue().catch(() => undefined);
  });
  return { release, requested };
}

/**
 * Log each change in whether Static/Live is on screen from now on. The first
 * value is the current presence, so `[true]` means it never went away.
 */
export async function watchPreviewModePresence(
  page: Page,
): Promise<() => Promise<boolean[]>> {
  await page.evaluate(() => {
    const present = () =>
      document.querySelector("[data-preview-mode]") !== null;
    const log = [present()];
    new MutationObserver(() => {
      if (log.at(-1) !== present()) log.push(present());
    }).observe(document.body, { childList: true, subtree: true });
    Object.assign(window, { moklyPreviewModeLog: log });
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { moklyPreviewModeLog: boolean[] })
          .moklyPreviewModeLog,
    );
}

/** Every workspace frame shows its script-free static document; none is Live. */
export async function expectStaticFrames(
  page: Page,
  frames = 2,
): Promise<void> {
  const staticFrames = page.locator("iframe[data-workspace-frame]");
  await expect(staticFrames).toHaveCount(frames);
  for (const frame of await staticFrames.all())
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
  await expect(page.locator(".mbk-live-frame")).toHaveCount(0);
}
