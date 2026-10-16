/** Validate the strict runner's sole optional argument before execution. */
export function parseShardArgument(args) {
  if (args.length === 0) return undefined;
  const value =
    args.length === 2 && args[0] === "--shard" ? args[1] : undefined;
  const match = /^(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) throw new Error("usage: run-browser.mjs [--shard INDEX/TOTAL]");
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(total) ||
    index < 1 ||
    total < index
  )
    throw new Error(`invalid browser shard ${value}`);
  return { index, total };
}
