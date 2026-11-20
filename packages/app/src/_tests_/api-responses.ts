import type { Page } from "@playwright/test";

import type { ApiReason } from "../api/reasons";

import { failureFor } from "./failures";

/**
 * The envelope the API sends for one reason, with the code and the status the
 * protocol's own table records for it. A fixture names the reason and nothing
 * else, so it cannot describe an answer the server has no way to produce.
 */
export function apiFailure(
  reason: ApiReason,
  message = "Try again shortly.",
): { status: number; body: string } {
  const { code, status } = failureFor(reason);
  return {
    status,
    body: JSON.stringify({
      error: {
        code,
        reason,
        message,
        request_id: "01994f10-0000-7000-8000-0000000000bb",
      },
    }),
  };
}

/**
 * Answer one endpoint with the failure the API would send for `reason`. Other
 * methods on the same address go through.
 */
export async function failWith(
  page: Page,
  url: string,
  method: string,
  reason: ApiReason,
): Promise<void> {
  const { status, body } = apiFailure(reason);
  await page.route(url, (route) => {
    if (route.request().method() !== method) return route.continue();
    return route.fulfill({ status, contentType: "application/json", body });
  });
}

/** Count what one press actually sent, so a second press cannot go unnoticed. */
export async function countRequests(
  page: Page,
  url: string,
  method: string,
): Promise<() => number> {
  let seen = 0;
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    seen += 1;
    // Held open, so a second press during the first cannot be mistaken for a
    // legitimate retry after it.
    await new Promise((done) => setTimeout(done, 1500));
    return route.continue();
  });
  return () => seen;
}
