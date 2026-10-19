/**
 * Shared actions for viewer journeys on the private Serve comparison fixture.
 * Serve captures each selected comparison on demand, so an action waits for
 * its comparison request through the redirect before UI deadlines apply.
 * Holds and emulations use `page.route`; Serve itself has no test seam.
 */

import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";

/** The stable endpoint of Serve's selected comparisons. */
export const SELECTED_ENDPOINT = "/mokly-viewer/diffs/review.json";

/** The attribute naming the snapshot address a pane or preview presents. */
export const PANE_SOURCE = "data-mokly-preview-source";

/** The renewal and metadata address of every selected generation. */
export const SELECTED_GENERATION =
  "**/diffs/generations/selected-*/review.json";

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
  expect(response.ok()).toBe(true);
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

/** Hold every renewal of a selected generation until the spec releases it. */
export async function holdRenewal(page: Page): Promise<{
  arrived: Promise<void>;
  finished: Promise<void>;
  release(): void;
  requests(): number;
}> {
  const arrived = gate();
  const release = gate();
  const finished = gate();
  let requests = 0;
  await page.route(SELECTED_GENERATION, async (route) => {
    if (route.request().method() !== "HEAD") {
      await route.continue();
      return;
    }
    requests++;
    const response = await route.fetch();
    arrived.resolve();
    await release.promise;
    await route.fulfill({ response }).catch(() => undefined);
    finished.resolve();
  });
  return {
    arrived: arrived.promise,
    finished: finished.promise,
    release: release.resolve,
    requests: () => requests,
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

/** The generation directory that owns one presented snapshot address. */
export function generationOf(source: string): string {
  const index = source.indexOf("/snapshots/");
  if (index < 0) throw new Error(`${source} is not a snapshot address`);
  return source.slice(0, index + 1);
}
