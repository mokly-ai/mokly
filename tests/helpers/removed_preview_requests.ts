import { createHash } from "node:crypto";

import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
import type { RemovedPreviewData } from "../../packages/viewer/dist/shell/previews.js";

export const GENERATION = "b".repeat(64);

export const COMPARISON = `/__mokly/diffs/__generations/${GENERATION}/review.json`;

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

export const pagePath = `__mokly/diffs/__generations/${GENERATION}/previews/removed-page/index.json`;

export function review(
  views: ReviewResultV5["screens"][number]["views"],
  baseCommit = "a".repeat(40),
) {
  return {
    schemaVersion: 5 as const,
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
        before: { path: "removed-screen", title: "Removed screen" },
        ...(views.some((view) => view.state !== "removed")
          ? { after: { path: "removed-screen", title: "Removed screen" } }
          : {}),
        path: "removed-screen",
        title: "Removed screen",
        state: "removed",
        dependencies: [],
        sharedImpact: [],
        views,
      },
    ],
  } satisfies ReviewResultV5;
}

export function snapshotId(
  sourceKind: "baseline" | "generation",
  sourceIdentity: string,
  data: RemovedPreviewData,
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
