/** Largest multiple of an even share of the browser test inventory that one shard may hold. */
export const BROWSER_SHARD_SHARE_LIMIT: 1.25;

/** The shard identity and test assignment that the balance bound reads. */
export interface BalancedShardReport {
  shard: { index: number };
  assignedTests: readonly unknown[];
}

/** Throw for the first shard above the share limit of `inventory` tests. */
export function validateBrowserShardBalance(
  reports: readonly BalancedShardReport[],
  inventory: number,
  total: number,
): void;
