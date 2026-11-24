import { expect, type Page } from "@playwright/test";

/**
 * Frame clock commands start only after every preview document has loaded:
 * the canvas frames of the routed screen `entry`, Desktop and Mobile in
 * Light and Dark, each with its own scheme's document.
 */
export async function staticFramesLoaded(page: Page, entry: string) {
  const frames = page.locator("iframe[data-workspace-frame]");
  await expect(frames).toHaveCount(4);
  for (const frame of await frames.all()) {
    const dark =
      (await frame.getAttribute("data-workspace-color-scheme")) === "dark"
        ? "\\.dark"
        : "";
    await expect
      .poll(() =>
        frame
          .contentFrame()
          .locator("html")
          .evaluate(() => ({
            path: location.pathname,
            readyState: document.readyState,
          })),
      )
      .toEqual({
        path: expect.stringMatching(
          new RegExp(`/${entry}/index\\.(?:mobile|desktop)${dark}\\.html$`),
        ),
        readyState: "complete",
      });
  }
}

/**
 * Observe actual browser requests across navigation, history, and fake-clock
 * work. `missing` lists the URLs that a spec removed from the copy on purpose.
 */
export function staticRequests(page: Page, missing: readonly string[] = []) {
  const urls: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => {
    urls.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !missing.includes(response.url()))
      failed.push(`${response.status()} ${response.url()}`);
  });
  return {
    urls,
    assert() {
      expect(failed, "every requested file exists").toEqual([]);
      expect(
        urls.filter((url) =>
          /\/mokly-viewer\/(?:events|live\.json|components\/renders?|diffs\/selection)(?:[/?]|$)/u.test(
            url,
          ),
        ),
        "static output has no live requests",
      ).toEqual([]);
    },
  };
}
