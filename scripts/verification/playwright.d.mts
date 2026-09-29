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

/** List every browser test, or one shard's tests, as Playwright assigns them. */
export function discoverBrowserTests(
  repositoryRoot: string,
  shard?: VerificationShard,
): Promise<BrowserTestInventory>;

/** Flatten a Playwright JSON list report into repository-relative identities. */
export function playwrightTests(
  report: unknown,
  repositoryRoot: string,
): DiscoveredBrowserTest[];
