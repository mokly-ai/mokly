import type { BudgetRow } from "./ci-timing-budgets.mjs";

/** One shard group of the budget file. */
export interface ShardGroup {
  name: string;
  /** Job-name patterns; a job that matches one of them is a shard of the group. */
  patterns: string[];
  /** Patterns of matching jobs that run other work, such as a lint shard. */
  exclude: string[];
  spreadMinutes: number;
  /** False when no weight file balances the group. */
  weighted: boolean;
}

/** A group with fewer than two passed shards, which has no spread. */
export interface UnmeasuredShards {
  group: ShardGroup;
  shards: number;
  passed: number;
}

/** A group with at least two passed shards. */
export interface MeasuredShards extends UnmeasuredShards {
  fastest: BudgetRow & { seconds: number };
  slowest: BudgetRow & { seconds: number };
  spreadSeconds: number;
  /** Seconds above the spread budget, or null when within it. */
  overSeconds: number | null;
}

export type ShardBalance = UnmeasuredShards | MeasuredShards;

export function parseShardGroups(value: unknown): ShardGroup[];

export function evaluateShards(
  rows: readonly BudgetRow[],
  groups: readonly ShardGroup[],
): ShardBalance[];

export function shardWarnings(shards: readonly ShardBalance[] | null): string[];

export function shardLines(shards: readonly ShardBalance[] | null): string[];
