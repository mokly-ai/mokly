import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { magicLinkFor } from "./api-server";

/** What the API answered one sign-in link request with. */
export interface LinkRequestAnswer {
  status: () => number;
  headers: () => Record<string, string>;
}

/**
 * Send one sign-in link request until the API admits it. The API admits
 * twenty link requests per peer address per minute, and a suite that signs in
 * for every test reaches that. Wait on the answer, then on the server's own
 * Retry-After, rather than pretending the limit is not there or guessing a
 * delay.
 */
export async function admitLinkRequest(
  page: Page,
  send: () => Promise<LinkRequestAnswer>,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const answer = await send();
    if (answer.status() === 202) return;
    expect(answer.status(), "the API admits or rate-limits the request").toBe(
      429,
    );
    expect(
      attempt,
      "the admission window reopens within one wait",
    ).toBeLessThan(1);
    const seconds = Number(answer.headers()["retry-after"] ?? "60");
    await page.waitForTimeout((seconds + 1) * 1000);
  }
}

/** The sign-in link the development mailer logged for one address. */
export async function mailedLink(email: string): Promise<string> {
  // The development mailer writes the link as it sends, so this polls the real
  // artefact until it appears rather than assuming a delivery delay.
  let link: string | undefined;
  await expect
    .poll(() => (link = magicLinkFor(email)) !== undefined, {
      message: "the development mailer logs the sign-in link",
      timeout: 30_000,
    })
    .toBe(true);
  return link as string;
}
