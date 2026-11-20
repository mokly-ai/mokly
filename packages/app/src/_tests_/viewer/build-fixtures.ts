import type {
  Branch,
  Build,
  BuildLog,
  BuildLogChunk,
  BuildSummary,
  PublicationSummary,
  PullRequest,
} from "../../api/types";

/**
 * Builds as the API reads them, for tests only. The product never invents a
 * build: every value a reader sees comes from `getBuild`, the log windows and
 * the reference rows. Typed by the generated client, so a field the contract
 * adds fails typecheck here rather than drifting into a fixture.
 */
export function build(over: Partial<Build> = {}): Build {
  return {
    id: "019a0000-0000-7000-8000-000000000b01",
    projectId: "019a0000-0000-7000-8000-000000000001",
    state: "running",
    trigger: "request",
    branch: "topic",
    headSha: "5d2e9a1c3f7b48e09a6d21c4b8f03e7a5d9c1b62",
    pullRequest: null,
    baseRef: "main",
    step: "install",
    createdAt: "2026-09-15T16:30:00Z",
    startedAt: "2026-09-15T16:30:05Z",
    finishedAt: null,
    attempt: 1,
    failure: null,
    publicationId: null,
    supersededBy: null,
    canCancel: true,
    ...over,
  };
}

/** One pull request a build publishes, as the read model carries it. */
export const buildPullRequest = {
  number: 14,
  title: "Host the catalogue",
  author: "octocat",
  url: "https://github.com/mokly-ai/mokly-cloud/pull/14",
} as const;

/** One log chunk as the API answers it. */
export function chunk(
  sequence: number,
  text: string,
  over: Partial<BuildLogChunk> = {},
): BuildLogChunk {
  return {
    sequence,
    attempt: 1,
    step: "install",
    stream: "stdout",
    text,
    ...over,
  };
}

/** One log window as the API answers it. */
export function logWindow(
  chunks: BuildLogChunk[],
  over: Partial<BuildLog> = {},
): BuildLog {
  return {
    chunks,
    nextAfter: chunks.length > 0 ? chunks[chunks.length - 1].sequence : 0,
    complete: false,
    elision: null,
    ...over,
  };
}

/** A reference row's newest build. */
export function summary(over: Partial<BuildSummary> = {}): BuildSummary {
  return {
    id: "019a0000-0000-7000-8000-000000000b02",
    state: "running",
    createdAt: "2026-09-15T16:30:00Z",
    headSha: "7a3c9e5b1d84f26c0e7a39d5b2f18c4e6a07d3b9",
    ...over,
  };
}

/** A reference row's newest publication attempt. */
export function attempt(
  over: Partial<PublicationSummary> = {},
): PublicationSummary {
  return {
    id: "019a0000-0000-7000-8000-0000000000a1",
    buildId: null,
    state: "ready",
    publishedAt: "2026-09-15T14:12:00Z",
    headSha: "72d6047e8b1c5a93f0d24e6b7a1c8f35e09d4b21",
    ...over,
  };
}

/** One branch row with the newest attempts a test gives it. */
export function branchRow(name: string, over: Partial<Branch> = {}): Branch {
  return {
    name,
    newestBuild: null,
    newestPublication: null,
    latestPublicationId: null,
    updatedAt: "2026-09-15T16:30:00Z",
    ...over,
  };
}

/** One open pull request row of the bound repository. */
export function pullRow(over: Partial<PullRequest> = {}): PullRequest {
  return {
    number: buildPullRequest.number,
    title: buildPullRequest.title,
    author: buildPullRequest.author,
    branch: "calummoore/catalogue-hosting",
    fork: false,
    state: "open",
    url: buildPullRequest.url,
    newestBuild: null,
    newestPublication: null,
    latestPublicationId: null,
    ...over,
  };
}

/** A stable build identifier for one test's named build. */
export function buildId(index: number): string {
  return "019a0000-0000-7000-8000-" + String(index).padStart(12, "0");
}
