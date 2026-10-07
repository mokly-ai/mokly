import type { PrConfiguration } from "./dependency-audit-pr-input.mjs";

/** Fetch boundary uses only the HTTP response fields that the client consumes. */
export type PrFetch = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json" | "headers">>;

/** REST pull request identity, checked independently of labels and author. */
export interface PrPullRequest {
  number: number;
  state: string;
  head: { ref: string; sha?: string; repo: { full_name: string } | null };
  labels?: readonly { name: string }[];
}

/** Repository operations needed to create, refresh and close update pull requests. */
export interface PrGitHub {
  openPullRequests(): Promise<PrPullRequest[]>;
  /** Return the closed update pull request whose head commit is `tip`, if any. */
  closedPullRequestAt(tip: string): Promise<number | undefined>;
  ensureLabel(): Promise<void>;
  createPullRequest(body: string): Promise<number>;
  labelPullRequest(number: number): Promise<void>;
  replaceBody(number: number, body: string): Promise<void>;
  closePullRequest(number: number): Promise<void>;
}

/** Compose repository REST operations over an injected fetch without logging headers. */
export function createPrGitHub(
  configuration: PrConfiguration,
  fetch: PrFetch,
): PrGitHub;
