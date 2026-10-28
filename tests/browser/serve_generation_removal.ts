/**
 * Removed generations for Serve journeys. Serve collects an idle selected
 * generation after 60 seconds, which a browser spec cannot wait for, so
 * `page.route` removes the generation's files as a collection does. Serve
 * itself keeps no test seam.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { SELECTED_ENDPOINT } from "./serve_comparison_ui.js";

/** One emulated removal of a generation. */
export interface RemovedGeneration {
  /** Whether the shell renewed the generation, which then answered 404. */
  renewed(): boolean;
  /** Each other request that reached the generation while it was gone. */
  refused(): string[];
}

/** Wait until every frame's document has loaded, with its subresources. */
async function documentsLoaded(frames: Locator): Promise<void> {
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all())
    await expect
      .poll(() =>
        frame.evaluate(
          (element: HTMLIFrameElement) => element.contentDocument?.readyState,
        ),
      )
      .toBe("complete");
}

/**
 * Remove the generation whose root is `generation` once every document in
 * `frames` has loaded. Its first renewal at `renewal`, the root of a
 * comparison or the removed detail of a preview, answers 404, and every other
 * request for one of its files answers 404 too and is refused, so a viewer
 * that reuses an old address fails.
 *
 * A selected generation stays gone, as after Serve collects it. The next
 * request to the stable endpoint then captures a new generation; the
 * emulation forwards that one request as a refresh.
 *
 * Serve keeps the classification generation that the index advertises, and
 * recaptures its snapshots on request, so that renewal does not fail in
 * Serve. The emulation fails it only to exercise the shell's reacquire of the
 * advertised root: the generation comes back when the shell requests the
 * renewal address again after the renewal.
 */
export async function removeGeneration(
  page: Page,
  generation: string,
  frames: Locator,
  renewal = generation,
): Promise<RemovedGeneration> {
  await documentsLoaded(frames);
  const selected = new URL(generation).pathname.includes(
    "/generations/selected-",
  );
  let renewed = false;
  let restored = false;
  const refused: string[] = [];
  await page.route(`${generation}**`, async (route) => {
    const request = route.request();
    const root = request.url() === renewal;
    if (restored) {
      await route.continue();
      return;
    }
    if (root && request.method() === "HEAD" && !renewed) {
      // The renewal finds the generation gone, as the journey expects.
      renewed = true;
      await route.fulfill({ status: 404 });
      return;
    }
    if (!selected && renewed && root && request.method() === "GET") {
      await route.fulfill({ response: await route.fetch() });
      restored = true;
      return;
    }
    refused.push(`${request.method()} ${request.url()}`);
    await route.fulfill({ status: 404 });
  });
  let replaced = false;
  if (selected)
    await page.route(`**${SELECTED_ENDPOINT}?*`, async (route) => {
      const url = new URL(route.request().url());
      if (replaced) {
        await route.continue();
        return;
      }
      // Only the first request after the removal captures anew; Serve
      // retains that capture for the requests that follow.
      replaced = true;
      url.searchParams.set("refresh", "1");
      await route.continue({ url: url.href });
    });
  return { renewed: () => renewed, refused: () => [...refused] };
}
