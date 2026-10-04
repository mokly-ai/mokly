import { createHash } from "node:crypto";

import type { ReviewResultV4 } from "../packages/viewer/dist/review/component_types.js";
import type { RemovedPreviewData } from "../packages/viewer/dist/shell/previews.js";

export const GENERATION = "b".repeat(64);

export const COMPARISON = `/mokly-viewer/diffs/generations/${GENERATION}/review.json`;

export const removedPage: RemovedPreviewData = {
  id: "removed-page",
  kind: "page",
  title: "Removed page",
};

export const removedScreen: RemovedPreviewData = {
  id: "removed-screen",
  kind: "screen",
  title: "Removed screen",
};

export const pagePath = `mokly-viewer/diffs/generations/${GENERATION}/pages/removed-page.json`;

export function review(
  views: ReviewResultV4["screens"][number]["views"],
  baseCommit = "a".repeat(40),
) {
  return {
    schemaVersion: 4,
    baseRef: "origin/main",
    baseCommit,
    changedPaths: [],
    sharedImpact: [],
    ignoredImpact: [],
    affectedConsumers: [],
    changes: [],
    components: [],
    screens: [
      {
        before: { id: "removed-screen", title: "Removed screen" },
        ...(views.some((view) => view.state !== "removed")
          ? { after: { id: "removed-screen", title: "Removed screen" } }
          : {}),
        id: "removed-screen",
        title: "Removed screen",
        state: "removed",
        dependencies: [],
        sharedImpact: [],
        views,
      },
    ],
  } satisfies ReviewResultV4;
}

export function snapshotId(
  sourceKind: "baseline" | "generation",
  sourceIdentity: string,
  data: RemovedPreviewData,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "mokly-historical-snapshot-v2",
        "c".repeat(64),
        sourceKind,
        sourceIdentity,
        data.kind,
        data.id,
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
