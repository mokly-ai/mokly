import { expect, type Locator, type Page } from "@playwright/test";

import type { RebuildStatus } from "@mokly/viewer/runtime";

/** The approved copy, restated so a drifting constant cannot pass. */
export const COPY = {
  explanation: "You’re seeing the last working version.",
  headline: "Your latest changes couldn’t be loaded.",
  hide: "Hide details",
  progress: "Updating…",
  region: "Error details",
  show: "Show details",
} as const;

/** What `#mb-status` must say once for each new failure. */
export const ANNOUNCEMENT = `${COPY.headline} ${COPY.explanation}`;

/** What one document has observed since it started. */
export interface RebuildPageLog {
  /** Each distinct message the polite status region was given. */
  announcements: string[];
  /** Progress became visible or hidden, on the page's own clock. */
  progress: { at: number; visible: boolean }[];
  /** Every validated `rebuild` event the document's stream received. */
  rebuild: { at: number; status: RebuildStatus }[];
}

/**
 * Plain browser JavaScript, so no test transpiler can inject helpers into it.
 * Only the shell document is instrumented; preview frames are left alone.
 */
const INSTRUMENTATION = `(() => {
  if (window !== window.top) return;
  const log = { announcements: [], progress: [], rebuild: [] };
  const streams = [];
  const Native = window.EventSource;
  class ControlledEventSource extends EventTarget {
    #native;
    constructor(url) {
      super();
      this.url = url;
      streams.push(this);
      this.reconnect();
    }
    close() {
      this.drop();
    }
    drop() {
      if (this.#native) this.#native.close();
      this.#native = undefined;
    }
    reconnect() {
      this.drop();
      const native = new Native(this.url);
      this.#native = native;
      for (const type of ["ready", "update", "rebuild", "interactive"])
        native.addEventListener(type, (event) => {
          if (this.#native !== native) return;
          if (type === "rebuild")
            log.rebuild.push({ at: performance.now(), status: JSON.parse(event.data) });
          this.dispatchEvent(new MessageEvent(type, { data: event.data }));
        });
    }
  }
  window.EventSource = ControlledEventSource;
  let spoken = null;
  let text = "";
  let progress = false;
  new MutationObserver(() => {
    const region = document.getElementById("mb-status");
    const node = region ? region.firstChild : null;
    const next = region ? region.textContent : "";
    if (next && (node !== spoken || next !== text)) log.announcements.push(next);
    spoken = node;
    text = next;
    const visible = document.querySelector(".mbk-progress") !== null;
    if (visible !== progress) log.progress.push({ at: performance.now(), visible });
    progress = visible;
  }).observe(document, { characterData: true, childList: true, subtree: true });
  window.moklyRebuildLog = log;
  window.moklyRebuildStreams = streams;
})();`;

/**
 * Record what the shell announces and shows, and route its update stream
 * through a controllable EventSource so a test can drop and reconnect it the
 * way the browser does after a lost connection.
 */
export async function instrument(page: Page): Promise<void> {
  await page.addInitScript({ content: INSTRUMENTATION });
}

/** Everything the current document has observed. */
export function readLog(page: Page): Promise<RebuildPageLog> {
  return page.evaluate(
    () =>
      (window as unknown as { moklyRebuildLog: RebuildPageLog })
        .moklyRebuildLog,
  );
}

/** How many times the failure announcement has been given. */
export async function failureAnnouncements(page: Page): Promise<number> {
  return (await readLog(page)).announcements.filter(
    (message) => message === ANNOUNCEMENT,
  ).length;
}

/** Close the document's update stream as a lost connection would. */
export function dropStream(page: Page): Promise<void> {
  return page.evaluate(() => {
    for (const stream of (
      window as unknown as { moklyRebuildStreams: { drop(): void }[] }
    ).moklyRebuildStreams)
      stream.drop();
  });
}

/** Open the stream again; the server replays its complete current state. */
export function reconnectStream(page: Page): Promise<void> {
  return page.evaluate(() => {
    for (const stream of (
      window as unknown as { moklyRebuildStreams: { reconnect(): void }[] }
    ).moklyRebuildStreams)
      stream.reconnect();
  });
}

/** Wait until the document has received a snapshot that matches. */
export async function expectReceived(
  page: Page,
  matches: (status: RebuildStatus) => boolean,
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await readLog(page)).rebuild.some(({ status }) => matches(status)),
      { timeout: 60_000 },
    )
    .toBe(true);
}

/** The notice, found by its accessible name. */
export function notice(page: Page): Locator {
  return page.getByRole("region", { name: COPY.headline });
}

/** The disclosure's control. */
export function summary(page: Page): Locator {
  return page.locator(".mbk-rebuild-details > summary");
}

/** The disclosed detail, found by its region name. */
export function detail(page: Page): Locator {
  return page.getByRole("region", { name: COPY.region });
}

/** Delayed progress in the top bar. */
export function progress(page: Page): Locator {
  return page.locator(".mbk-topbar .mbk-progress");
}

/** Wait for the hydrated shell of a freshly loaded document. */
export async function hydrated(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
}

/** Rounded boxes of every region that progress and the notice must not move. */
export function geometry(page: Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const { x, y, width, height } = node.getBoundingClientRect();
      return {
        height: round(height),
        width: round(width),
        x: round(x),
        y: round(y),
      };
    };
    return {
      appearance: box(".mbk-appearance"),
      body: box(".mbk-body"),
      brand: box(".mbk-brand"),
      main: box("#mb-main"),
      menu: box(".mbk-menu"),
      navigation: box(".mbk-nav"),
      notice: box(".mbk-rebuild"),
      scroll: [window.scrollX, window.scrollY],
      stage: box(".mbk-stage"),
      topBar: box(".mbk-topbar"),
    };
  });
}
