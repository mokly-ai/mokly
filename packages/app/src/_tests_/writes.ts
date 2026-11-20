import type { Locator, Page } from "@playwright/test";

import { expect } from "./harness";
import { apiOrigin } from "./origins";

/** Press a write control and wait for that write's successful answer. */
export async function pressWrite(
  page: Page,
  control: Locator,
  method: "DELETE" | "PATCH" | "POST" | "PUT",
  path: string,
): Promise<void> {
  const [written] = await Promise.all([
    page.waitForResponse((answer) => {
      const url = new URL(answer.url());
      return (
        answer.request().method() === method &&
        url.origin === apiOrigin &&
        url.pathname === path
      );
    }),
    control.click(),
  ]);
  expect(written.ok()).toBe(true);
}
