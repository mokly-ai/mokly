import type { VerificationShard } from "./evidence.mjs";
import type { BrowserTestInventory } from "./playwright.mjs";

/** Per-test scheduling costs for known specs; absent specs use the median. */
export type BrowserShardWeights = Readonly<Record<string, number>>;

/** Estimated setup time of the copied static example on one shard. */
export const COPIED_HOST_SETUP_MS: number;

/** One shard's whole files and tests, and whether it needs the copied host. */
export interface BrowserShardSelection extends BrowserTestInventory {
  copiedHost: boolean;
}

/** Select a whole-file partition from the complete discovered inventory. */
export function selectBrowserShard(
  inventory: BrowserTestInventory,
  shard: VerificationShard,
  weights?: BrowserShardWeights,
  copiedSpecs?: ReadonlySet<string>,
): BrowserShardSelection;

/** Produce exact, escaped Playwright file patterns for a selected partition. */
export function browserFileArguments(files: readonly string[]): string[];
