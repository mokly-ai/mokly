import type { Page } from "@playwright/test";

import type {} from "../../packages/viewer/tests/evidence_entry.js";

import type {} from "./viewer_harness.js";

type PickCompletion =
  { status: "pending" | "resolved" } | { status: "rejected"; error: unknown };

declare global {
  interface Window {
    viewerPickCompletion?: PickCompletion;
  }
}

/** Observe the imperative pick API without awaiting its promise through CDP. */
export async function startViewerPick(
  page: Page,
  source: "viewer" | "evidence" = "viewer",
): Promise<void> {
  await page.evaluate((source) => {
    window.viewerPickCompletion = { status: "pending" };
    const handle =
      source === "evidence"
        ? window.evidence.frames
        : window.viewerHarness.get("one").ref.current;
    void handle.startPick().then(
      () => {
        window.viewerPickCompletion = { status: "resolved" };
      },
      (error: unknown) => {
        window.viewerPickCompletion = { status: "rejected", error };
      },
    );
  }, source);
  await page.waitForFunction(() => {
    const completion = window.viewerPickCompletion;
    return completion && completion.status !== "pending";
  });
  await page.evaluate(() => {
    const completion = window.viewerPickCompletion;
    delete window.viewerPickCompletion;
    if (completion?.status === "rejected") throw completion.error;
    if (completion?.status !== "resolved")
      throw new Error("Expected a completed viewer pick");
  });
}
