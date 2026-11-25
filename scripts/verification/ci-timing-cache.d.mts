import type { GitHubRequest } from "./ci-timing-jobs.mjs";

/** The cache budget of the budget file. */
export interface CacheBudget {
  gigabytes: number;
  largestEntries: number;
}

/** One Actions cache entry. */
export interface CacheEntry {
  key: string;
  ref: string;
  bytes: number;
  /** The last use as `YYYY-MM-DD HH:MM UTC`, or null when unknown. */
  lastUsed: string | null;
}

/** The cache usage of the repository against its budget. */
export interface CacheReport {
  totalBytes: number;
  count: number;
  budgetGigabytes: number;
  /** Bytes above the budget, or null when within it. */
  overBytes: number | null;
  largest: CacheEntry[];
  otherRefs: CacheEntry[];
  issues: string[];
}

export const SAVING_REF: "refs/heads/main";

export function parseCacheBudget(value: unknown): CacheBudget;

export function fetchCaches(request: GitHubRequest): Promise<unknown>;

export function evaluateCache(body: unknown, budget: CacheBudget): CacheReport;

export function cacheWarnings(cache: CacheReport | null): string[];

export function cacheLines(cache: CacheReport | null): string[];
