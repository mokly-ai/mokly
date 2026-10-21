import type { BrowserShardWeights } from "./browser-partition.mjs";
import type { VerificationShard } from "./evidence.mjs";

/** One Playwright test identity from a JSON list report. */
export interface DiscoveredBrowserTest {
  id: string;
  project: string;
  /** Spec file that Playwright loaded to register the test; file inventories use it. */
  specFile: string;
  /** File that defines the test; a helper module when the spec imports its tests. */
  file: string;
  line: number;
  column: number;
  title: string;
}

/** A complete or sharded Playwright browser test inventory. */
export interface BrowserTestInventory {
  files: string[];
  tests: DiscoveredBrowserTest[];
}

export interface BrowserDiscoveryOptions {
  project?: string;
  shard?: VerificationShard;
  weights?: BrowserShardWeights;
}

/** Discover one Playwright project, then optionally select a weighted shard. */
export function discoverBrowserTests(
  repositoryRoot: string,
  options?: BrowserDiscoveryOptions,
): Promise<BrowserTestInventory>;

/** Observed duration and test count for one spec file. */
export interface ObservedBrowserFile {
  file: string;
  durationMs: number;
  tests: number;
}

/** Sum observed test durations and counts per spec file, sorted by file. */
export function summarizeObservedFiles(
  tests: readonly { specFile: string; durationMs: number }[],
): ObservedBrowserFile[];
