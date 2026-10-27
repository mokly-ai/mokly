/**
 * Shared actions for viewer journeys on the private Serve comparison fixture.
 * Serve captures a selected comparison on demand. When the same entry is
 * selected again, Serve reuses the stored comparison while it keeps it, and
 * a refresh captures again. Either way, an action waits for its comparison
 * request through the redirect before UI deadlines apply. Holds and
 * emulations use `page.route`; Serve itself has no test seam.
 */

import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { endedRequests, passRenderingUpdates } from "./page_settling.js";

/** The stable endpoint of Serve's selected comparisons. */
export const SELECTED_ENDPOINT = "/mokly-viewer/diffs/selection";

/** The attribute naming the snapshot address a pane or preview presents. */
export const PANE_SOURCE = "data-mokly-preview-source";

/** The root of every selected generation, which the shell renews. */
export const SELECTED_GENERATION = "**/diffs/generations/selected-*/";

/** A button that starts a selected comparison request. */
export type ComparisonAction =
  | "Difference"
  | "Overlay"
  | "Refresh comparison"
  | "Side by side"
  | "Try again";

/**
 * Run `trigger` and wait for the selected comparison request it starts,
 * through its redirect, before the caller applies UI deadlines. A refresh
 * request carries `refresh=1`; any other request must not.
 */
export async function awaitSelectedComparison(
  page: Page,
  trigger: () => Promise<void>,
  refresh = false,
): Promise<void> {
  const origin = new URL(page.url()).origin;
  let initiating: Request | undefined;
  const request = page.waitForRequest(
    (candidate) => {
      const url = new URL(candidate.url());
      const matches =
        candidate.redirectedFrom() === null &&
        candidate.frame() === page.mainFrame() &&
        candidate.method() === "GET" &&
        candidate.resourceType() === "fetch" &&
        url.origin === origin &&
        url.pathname === SELECTED_ENDPOINT &&
        (url.searchParams.get("refresh") === "1") === refresh;
      if (matches) initiating = candidate;
      return matches;
    },
    { timeout: 30_000 },
  );
  const [response] = await Promise.all([
    page.waitForResponse(
      (result) => {
        let root = result.request();
        while (root.redirectedFrom()) root = root.redirectedFrom()!;
        return (
          root === initiating &&
          (result.status() < 300 || result.status() >= 400)
        );
      },
      { timeout: 30_000 },
    ),
    request,
    trigger(),
  ]);
  // The selection ends at its generation's root, which answers 204.
  expect(response.status()).toBe(204);
  expect(await response.finished()).toBeNull();
}

/** Click one comparison button and wait for its selected comparison. */
export async function loadComparison(
  page: Page,
  action: ComparisonAction,
): Promise<void> {
  await awaitSelectedComparison(
    page,
    () => page.getByRole("button", { name: action, exact: true }).click(),
    action === "Try again" || action === "Refresh comparison",
  );
}

/** Every request to the stable selected endpoint, in the order the page made them. */
export function selectedRequests(page: Page): URL[] {
  const requests: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === SELECTED_ENDPOINT)
      requests.push(url);
  });
  return requests;
}

/** A promise with its resolver, for holding and releasing routed requests. */
export function gate(): { promise: Promise<void>; resolve(): void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((ready) => {
    resolve = ready;
  });
  return { promise, resolve };
}

/**
 * What became of one held renewal: `delivered` when the page received its
 * response, `cancelled` when the page ended it first, `pending` before then.
 * Chromium reports `net::ERR_ABORTED` for every fetch HEAD, also one whose
 * response the page read, so the failure text cannot tell these apart.
 */
export type RenewalOutcome = "cancelled" | "delivered" | "pending";

/** Renewals of a selected generation that a spec holds and then releases. */
export interface HeldRenewal {
  /** Resolves when the first renewal is held. */
  arrived: Promise<void>;
  /**
   * Deliver every held response, then wait until the browser ended each held
   * request and the page rendered the outcome.
   */
  release(): Promise<void>;
  /** Deliver every held response at once, for cleanup after a failure. */
  unblock(): void;
  /** How many renewals the page sent. */
  requests(): number;
  /** The outcome of each held renewal, in request order. */
  outcomes(): RenewalOutcome[];
}

/** Hold every renewal of a selected generation until the spec releases it. */
export async function holdRenewal(page: Page): Promise<HeldRenewal> {
  const arrived = gate();
  const released = gate();
  const ended = endedRequests(page);
  const held: Request[] = [];
  const responded = new Set<Request>();
  page.on("response", (response) => {
    if (held.includes(response.request())) responded.add(response.request());
  });
  await page.route(SELECTED_GENERATION, async (route) => {
    if (route.request().method() !== "HEAD") {
      await route.continue();
      return;
    }
    held.push(route.request());
    const response = await route.fetch();
    arrived.resolve();
    await released.promise;
    // Fulfilling a request that the page cancelled may fail or do nothing;
    // the outcome comes from the browser's events, not from this call.
    await route.fulfill({ response }).catch(() => undefined);
  });
  return {
    arrived: arrived.promise,
    async release() {
      released.resolve();
      await expect
        .poll(() => held.every((request) => ended.has(request)))
        .toBe(true);
      await passRenderingUpdates(page);
    },
    unblock: released.resolve,
    requests: () => held.length,
    outcomes: () =>
      held.map((request) =>
        !ended.has(request)
          ? "pending"
          : responded.has(request)
            ? "delivered"
            : "cancelled",
      ),
  };
}

/**
 * Expect a comparison pane to present a viewer-owned, script-disabled
 * `srcdoc` document from a selected generation, never a framed snapshot.
 */
export async function expectPresentedPane(
  frame: Locator,
  source:
    | RegExp
    | string = /\/mokly-viewer\/diffs\/generations\/selected-[^/]+\/snapshots\/(?:before|after)\//u,
): Promise<void> {
  await expect(frame).toHaveAttribute("data-mokly-comparison-frame", "");
  await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
  await expect(frame).toHaveAttribute("scrolling", "no");
  await expect(frame).toHaveAttribute("srcdoc", /\S/u);
  await expect(frame).not.toHaveAttribute("src", /.*/u);
  await expect(frame).toHaveAttribute(PANE_SOURCE, source);
}

/**
 * Expect the `side` pane of a Card comparison against the fixture's own base
 * to show `heading` and the `.accent` colour of that side's commit. Card's
 * own heading is the same in both commits, so only the colour proves which
 * version the pane shows.
 */
export async function expectCardPane(
  page: Page,
  side: "after" | "before",
  heading: string,
): Promise<void> {
  const frame = page.frameLocator(`.mb-pane--${side} iframe`);
  await expect(frame.locator("h2")).toHaveText(heading);
  await expect(frame.locator(".accent")).toHaveCSS(
    "color",
    accentColor[side === "before" ? "Before" : "After"],
  );
}

/** The generation directory that owns one presented snapshot address. */
export function generationOf(source: string): string {
  const index = source.indexOf("/snapshots/");
  if (index < 0) throw new Error(`${source} is not a snapshot address`);
  return source.slice(0, index + 1);
}
