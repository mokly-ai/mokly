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

for (const [kind, route, documents] of [
  [
    "screen",
    "/view/example/screens/welcome/",
    "**/static/mokly-generated/example/screens/welcome/index.*",
  ],
  [
    "document",
    "/view/example/workspace-guide/",
    "**/static/mokly-generated/example/workspace-guide/index*.html",
  ],
] as const)
  test(`a ${kind} preview that failed to load recovers with Try again`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const succeed = await failLoads(page, documents);
    await page.goto(route);
    const line = page.getByRole("status").filter({
      hasText: "This preview could not be loaded.",
    });
    await expect(line.first()).toBeVisible();
    const frames = page.locator("iframe[data-mokly-frame-state]");
    await expect(frames.first()).toHaveAttribute(
      "data-mokly-frame-state",
      "error",
    );
    succeed();
    while ((await line.count()) > 0)
      await line.first().getByRole("button", { name: "Try again" }).click();
    await expect(line).toHaveCount(0);
    for (const frame of await frames.all())
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  });
