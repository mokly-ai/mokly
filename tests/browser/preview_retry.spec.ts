import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";

/**
 * Fail every load of the matched documents until the returned function lets
 * them through. An aborted load leaves the frame on the browser's error page,
 * which the same-origin adapter rejects.
 */
async function failLoads(page: Page, pattern: string): Promise<() => void> {
  let failing = true;
  await page.route(pattern, (route) =>
    failing ? route.abort() : route.continue(),
  );
  return () => {
    failing = false;
  };
}

for (const [kind, route, documents, count] of [
  [
    "screen",
    "/view/example/screens/welcome/",
    "**/static/mokly-generated/example/screens/welcome/index.*",
    2,
  ],
  [
    "document",
    "/view/example/workspace-guide/",
    "**/static/mokly-generated/example/workspace-guide/index*.html",
    1,
  ],
] as const)
  test(`a ${kind} preview that failed to load recovers with Try again`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const succeed = await failLoads(page, documents);
    await page.goto(route);
    const frames = page.locator("iframe[data-mokly-frame-state]");
    await expect(frames).toHaveCount(count);
    // Every frame fails before any load may pass.
    for (const frame of await frames.all())
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "error");
    const line = page.getByRole("status").filter({
      hasText: "This preview could not be loaded.",
    });
    await expect(line).toHaveCount(count);
    succeed();
    // The lines and the frames share their order, and each Try again focuses
    // the frame that it loads again.
    for (let left = count; left > 0; left--) {
      await line.first().getByRole("button", { name: "Try again" }).click();
      await expect(line).toHaveCount(left - 1);
      await expect(frames.nth(count - left)).toBeFocused();
    }
    for (const frame of await frames.all())
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  });
