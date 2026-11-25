import type { VerificationShard } from "./evidence.mjs";

/** Measured milliseconds per known Node test file; absent files use the median. */
export type ViewerShardWeights = Readonly<Record<string, number>>;

/** Select the whole files of one shard, in discovery order. */
export function selectViewerShard(
  files: readonly string[],
  shard: VerificationShard,
  weights?: ViewerShardWeights,
): string[];
