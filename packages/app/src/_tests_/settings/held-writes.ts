import type { Page } from "@playwright/test";

import { expect } from "../harness";

/**
 * Hold one write until the test lets it go, so a confirmation can be asked
 * what it does while its write is in flight.
 */
export async function holdWrite(
  page: Page,
  url: string,
  method: string,
): Promise<() => void> {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    await held;
    await route.continue();
  });
  return release;
}

/** Neither Escape nor a press outside abandons a write already sent. */
export async function holdsWhileSending(
  page: Page,
  question: string,
): Promise<void> {
  const modal = page.getByRole("dialog", { name: question, exact: true });
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await expect(modal).toBeVisible();
}
