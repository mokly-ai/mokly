import type { VerificationShard } from "./evidence.mjs";
import type { BrowserTestInventory } from "./playwright.mjs";

/** Per-test scheduling costs for known specs; absent specs use the median. */
export type BrowserShardWeights = Readonly<Record<string, number>>;

/** Select a whole-file partition from the complete discovered inventory. */
export function selectBrowserShard(
  inventory: BrowserTestInventory,
  shard: VerificationShard,
  weights?: BrowserShardWeights,
): BrowserTestInventory;

/** Produce exact, escaped Playwright file patterns for a selected partition. */
export function browserFileArguments(files: readonly string[]): string[];
