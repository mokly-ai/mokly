/** Largest multiple of an even share of the browser test inventory that one shard may hold. */
export const BROWSER_SHARD_SHARE_LIMIT = 1.25;

/**
 * Reject the first browser shard that holds more tests than the share limit
 * allows. Playwright balances whole spec files by test count, so a shard above
 * the limit usually holds one spec that is too large.
 */
export function validateBrowserShardBalance(reports, inventory, total) {
  const limit = Math.ceil((inventory / total) * BROWSER_SHARD_SHARE_LIMIT);
  for (const report of reports) {
    const count = report.assignedTests.length;
    if (count > limit)
      throw new Error(
        `browser shard ${report.shard.index}/${total} holds ${count} of ${inventory} tests, above the limit of ${limit}; split a large spec into smaller spec files`,
      );
  }
}
