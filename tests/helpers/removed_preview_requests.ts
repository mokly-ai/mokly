import { createHash } from "node:crypto";

import type {
  ReviewResult,
  ReviewView,
} from "../../packages/viewer/dist/review/types.js";
import type { RemovedPreviewData } from "../../packages/viewer/dist/shell/previews.js";

export const GENERATION = "b".repeat(64);

export const COMPARISON = `/mokly-viewer/diffs/generations/${GENERATION}/review.json`;

export const removedPage: RemovedPreviewData = {
  path: "removed-page",
  kind: "page",
  title: "Removed page",
};

export const removedScreen: RemovedPreviewData = {
  path: "removed-screen",
  kind: "screen",
  title: "Removed screen",
};

export const pagePath = `mokly-viewer/diffs/generations/${GENERATION}/previews/removed-page/index.json`;

/**
 * A review v8 result whose screen `removed-screen` has these views: removed
 * when every view is removed, else changed with a current side.
 */
export function review(
  views: ReviewView[],
  baseCommit = "a".repeat(40),
): ReviewResult {
  const side = { path: "removed-screen", title: "Removed screen", props: {} };
  const removed = views.every((view) => view.state === "removed");
  return {
    schemaVersion: 8,
    baseCommit,
    entries: [
      {
        kind: "screen",
        path: "removed-screen",
        title: "Removed screen",
        before: side,
        ...(removed ? {} : { after: side }),
        state: removed ? "removed" : "changed",
        included: true,
        reasons: [{ kind: removed ? "removed" : "material" }],
        views,
      },
    ],
    affected: [],
    diagnostics: [],
  };
}

/**
 * The historical snapshot id of an entry at a base commit, or under another
 * source kind that the identity contract does not define.
 */
export function snapshotId(
  sourceIdentity: string,
  data: RemovedPreviewData,
  sourceKind = "base",
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "mokly-historical-snapshot-v3",
        "c".repeat(64),
        sourceKind,
        sourceIdentity,
        data.kind,
        data.path,
      ]),
    )
    .digest("hex");
}

export function respond(payload: unknown, url: string, ok = true) {
  const win = {
    fetch: async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      return {
        ok,
        url,
        json: async () => payload,
      } as unknown as Response;
    },
  } as unknown as Window & typeof globalThis;
  const calls: { url: string; method: string }[] = [];
  return { calls, win };
}
