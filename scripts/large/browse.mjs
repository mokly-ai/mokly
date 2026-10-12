import { setTimeout } from "node:timers/promises";

/** Setup's unrelated stylesheet edit matches no screen at any size. */
export const expectedStylesheetChanges = 0;

/** Classification publication precedes asynchronous IPC delivery and child adoption. */
export async function waitForBrowseChanges(url, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(
        Math.min(60000, Math.max(1, deadline - Date.now())),
      ),
    });
    if (!response.ok)
      throw new Error(`Browse returned HTTP ${response.status}`);
    const html = await response.text();
    if (html.includes('data-changes-status="ready"')) return html;
    if (html.includes('data-changes-status="unavailable"'))
      throw new Error("Changes is unavailable in Browse");
    await setTimeout(100);
  }
  throw new Error("Changes was not delivered to Browse before the deadline");
}
