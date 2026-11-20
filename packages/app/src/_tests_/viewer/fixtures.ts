import type { Branch, Publication, PullRequest } from "../../api/types";

/** The reader's own preference, which every address is read against. */
export const defaults = { scheme: "light" as const };

/**
 * A removed screen and the opaque snapshot identity the packaged catalogue
 * index v9 fixture publishes beside it: the pair that names one previous
 * version.
 */
export const removed = {
  screen: "product/browse/home/retired",
  snapshotId:
    "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e",
} as const;

/** One ready publication with a catalogue, varied by what a test is about. */
export function publication(over: Partial<Publication> = {}): Publication {
  return {
    id: "p1",
    projectId: "proj",
    buildId: null,
    branch: "main",
    headSha: "76d15b689ce73bad1e39aa6323368134c7785b1e",
    publishedAt: "2026-09-15T14:20:00Z",
    state: "ready",
    catalogueUrl: "https://p-p1.catalogues.example",
    reviewId: null,
    changes: { state: "available", added: 1, changed: 0, removed: 0 },
    canComment: false,
    failureCode: null,
    pullRequest: null,
    ...over,
  };
}

/** One reference row as the read model returns it. */
export function branch(
  name: string,
  latest: string | null,
  updatedAt = "2026-09-15T00:00:00Z",
): Branch {
  return {
    name,
    latestPublicationId: latest,
    updatedAt,
    newestPublication: null,
    newestBuild: null,
  };
}

/** One pull request row of the bound repository, as the read model returns it. */
export function pullRequest(over: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 4,
    title: "Host the viewer",
    author: "octocat",
    branch: "feature",
    fork: false,
    state: "open",
    url: "https://github.com/mokly-ai/mokly-cloud/pull/4",
    newestPublication: null,
    newestBuild: null,
    latestPublicationId: null,
    ...over,
  };
}
