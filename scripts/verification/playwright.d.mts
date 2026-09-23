import type { VerificationShard } from "./evidence.mjs";

export interface DiscoveredBrowserTest {
  readonly id: string;
  readonly project: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly title: string;
}

export function discoverBrowserTests(
  repositoryRoot: string,
  shard?: VerificationShard,
): Promise<{ files: string[]; tests: DiscoveredBrowserTest[] }>;
