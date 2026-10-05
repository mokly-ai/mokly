import type { VerificationShard } from "./evidence.mjs";

/** One Playwright test identity from a JSON list report. */
export interface DiscoveredBrowserTest {
  id: string;
  project: string;
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
}

/** List one Playwright project, optionally sharded, as Playwright assigns it. */
export function discoverBrowserTests(
  repositoryRoot: string,
  options?: BrowserDiscoveryOptions,
): Promise<BrowserTestInventory>;
