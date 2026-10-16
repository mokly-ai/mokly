import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { expectedConsoleNotice } from "./console_notices.js";

/** Retain script failures and console errors outside the shared sandbox rule. */
export function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedConsoleNotice(message))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Register a clean-console assertion for each page in the calling spec. */
export function checkBrowserErrors(): void {
  const errors = new WeakMap<Page, string[]>();
  test.beforeEach(({ page }) => {
    errors.set(page, captureBrowserErrors(page));
  });
  test.afterEach(async ({ page }) => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(errors.get(page)).toEqual([]);
  });
}
