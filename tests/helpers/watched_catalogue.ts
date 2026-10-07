import assert from "node:assert/strict";

import { waitUntil } from "./wait_until.js";

/** Read the current watched shell without starting a comparison build. */
export async function catalogue(url: string): Promise<string> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.text();
}

/** Wait for initial background publication before testing an already-running catalogue. */
export function waitForInitialChanges(
  url: string,
  timeoutMs = 20_000,
): Promise<string> {
  return waitForPublished(
    url,
    0,
    (html) => /data-changes-status="(?:ready|unavailable)"/.test(html),
    "completed initial Changes",
    timeoutMs,
  );
}

/** Extract the server version stamped into one shell response. */
export function version(html: string): number {
  const value = html.match(/data-mokly-update-version="(\d+)"/)?.[1];
  assert.ok(value);
  return Number(value);
}

/** The real Changes count, absent while checking or when unavailable. */
export function changedCount(html: string): number | undefined {
  const value = html.match(/class="mbk-nav-filter-count">(\d+)</)?.[1];
  return value === undefined ? undefined : Number(value);
}

/** Wait for a fully published watch action to reach the current catalogue. */
export function waitForUpdate(url: string, previous: number): Promise<string> {
  return waitForPublished(url, previous, () => true, "a watched update");
}

/**
 * Wait for a published watch action whose catalogue settles on `expected`
 * changed screens, or unavailable Changes when `expected` is undefined.
 * Pending counts are not terminal results and never satisfy this wait.
 *
 * An edit built from several filesystem operations — removing a file before
 * replacing it, creating a directory before the file inside it — publishes one
 * update per event while debouncing is off, so the first published version can
 * carry the state between those operations. Waiting for the expected count lets
 * those intermediate publications pass instead of asserting against one.
 */
export function waitForChangedCount(
  url: string,
  previous: number,
  expected?: number,
): Promise<string> {
  return waitForPublished(
    url,
    previous,
    (html) =>
      changedCount(html) === expected &&
      html.includes(
        `data-changes-status="${expected === undefined ? "unavailable" : "ready"}"`,
      ),
    expected === undefined
      ? "unavailable Changes"
      : `${expected} changed screens`,
  );
}

/** Wait until initial background classification installs a Changes count. */
export async function waitForClassifiedCount(
  url: string,
  expected: number,
): Promise<string> {
  const initial = await catalogue(url);
  if (changedCount(initial) === expected) return initial;
  return waitForChangedCount(url, version(initial), expected);
}

/**
 * Poll the watched catalogue until it publishes a newer version that satisfies
 * `settled`, reporting the last state it did publish when the wait runs out.
 */
async function waitForPublished(
  url: string,
  previous: number,
  settled: (html: string) => boolean,
  expectation: string,
  timeoutMs = 20_000,
): Promise<string> {
  let published: string | undefined;
  let latest: string | undefined;
  return waitUntil(
    async () => {
      try {
        const html = await catalogue(url);
        latest = html;
        if (version(html) > previous) {
          published = html;
          if (settled(html)) return html;
        }
      } catch (error) {
        const code = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
        if (
          !code ||
          !["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(code)
        )
          throw error;
      }
      return undefined;
    },
    {
      timeoutMs: Math.max(15_000, timeoutMs),
      intervalMs: 50,
      message: () =>
        `referenced resource edit did not publish ${expectation}; ${
          published === undefined
            ? "no watched update was published"
            : `the last published update had ${changedCount(published) ?? "no"} changed screens`
        }; waiting after version ${previous}; ${
          latest === undefined
            ? "no catalogue response"
            : `last version ${version(latest)}, Changes ${changedCount(latest) ?? "unavailable"}`
        }`,
    },
  );
}
