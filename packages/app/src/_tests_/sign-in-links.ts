import { createHash } from "node:crypto";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { magicLinkFor } from "./api-server";
import { sql } from "./database-fixture";
import { apiBind } from "./origins";

/** What the API answered one sign-in link request with. */
export interface LinkRequestAnswer {
  status: () => number;
  headers: () => Record<string, string>;
}

/**
 * Reopen the link admission window of the suite's own peer address. The API
 * admits twenty link requests per peer address per minute, and every test
 * signs in from the one loopback address the API binds, so twenty sign-ins of
 * any tests in one minute would make the next test wait out the window. Each
 * request starts from an empty window instead, as each test starts from its
 * own data. This clears the row the limit keeps, keyed as `mkc-auth` keys it:
 * the SHA-256 of `peer:` and the client address. The request still goes
 * through the real admission.
 */
function reopenPeerWindow(): void {
  const peer = apiBind.slice(0, apiBind.lastIndexOf(":"));
  const key = createHash("sha256").update(`peer:${peer}`).digest("hex");
  sql(`DELETE FROM auth_rate_limits WHERE key = '${key}'`);
}

/**
 * Send one sign-in link request until the API admits it, each time from a
 * reopened peer window. Should the API still refuse it, wait on the answer,
 * then on the server's own Retry-After, rather than guessing a delay.
 */
export async function admitLinkRequest<Answer extends LinkRequestAnswer>(
  page: Page,
  send: () => Promise<Answer>,
): Promise<Answer> {
  for (let attempt = 0; ; attempt += 1) {
    reopenPeerWindow();
    const answer = await send();
    if (answer.status() === 202) return answer;
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
