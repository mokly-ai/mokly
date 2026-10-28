import { createHash } from "node:crypto";

import type { ReviewView } from "../../packages/viewer/dist/review/types.js";
import type { RemovedPreviewData } from "../../packages/viewer/dist/shell/previews.js";

export const GENERATION = "b".repeat(64);

/** The comparison's generation root, which owns every historical document. */
export const COMPARISON = `/mokly-viewer/diffs/generations/${GENERATION}/`;

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

/** The removed detail address of screen `removed-screen` inside the generation. */
export const screenPath = `mokly-viewer/diffs/generations/${GENERATION}/entries/removed-screen.json`;

/**
 * The entry detail v3 of a removed screen with these captured views, which
 * names this snapshot id and, by default, the screen `removed-screen`.
 */
export function removedDetail(
  views: ReviewView[],
  snapshotId = "e".repeat(64),
  path = "removed-screen",
) {
  return {
    schemaVersion: 3,
    identity: { id: "c".repeat(64), title: "Mokly" },
    detailId: "d".repeat(64),
    entry: { kind: "screen", path, snapshotId },
    reasons: [{ kind: "removed" }],
    views: views.map((view) => ({
      ...view,
      usage: { status: "ready", instances: [], slots: [], ranges: [] },
      resourceEvidence: { rules: [], resources: [] },
    })),
    controlOrder: [],
    workspace: {
      comparisonEligible: false,
      usedBy: [],
      affected: [],
      relatedComponents: [],
      inputChanges: [],
    },
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
