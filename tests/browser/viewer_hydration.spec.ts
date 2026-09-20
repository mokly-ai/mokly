import { expect, test } from "@playwright/test";

import { viewerHydrationFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerHydrationFixture>>;
test.beforeAll(async () => {
  fixture = await viewerHydrationFixture();
});
test.afterAll(async () => fixture?.close());

test("application-owned server HTML hydrates in place", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${fixture.host.url}/hydration.html`);
  await page.waitForFunction(() =>
    Boolean(window.viewerHydrationHarness?.ref.current),
  );
  await expect(page.locator("[data-mokly-nav]")).toHaveAttribute(
    "data-resize-ready",
    "",
  );

  const result = await page.evaluate(() => ({
    errors: window.viewerHydrationHarness.recoverableErrors,
    retained: window.viewerHydrationHarness.retained(),
  }));
  expect(result).toEqual({
    errors: [],
    retained: { frame: true, shell: true },
  });
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) =>
      /hydration|server rendered|client rendered/i.test(message),
    ),
  ).toEqual([]);
});
