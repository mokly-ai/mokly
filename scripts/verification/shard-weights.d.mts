/** Rounded median weights of the browser specs and the viewer test files. */
export interface ShardWeights {
  browser: Record<string, number>;
  viewer: Record<string, number>;
}

/** Compute both weight maps from passed CI reports. */
export function shardWeights(reports: readonly unknown[]): ShardWeights;

/** Write both weight files from the reports under one directory. */
export function writeShardWeights(
  directory: string,
): Promise<{ browser: number; viewer: number }>;
