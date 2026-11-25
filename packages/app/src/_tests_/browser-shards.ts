/**
 * Whole-file shards of the app browser suite, balanced by measured duration.
 *
 * Playwright's own `--shard` gives each shard about the same number of spec
 * files, but the app's spec files differ in duration by up to a hundred times.
 * This plan places each file, from the longest to the shortest, on the shard
 * with the least measured work so far. Measurements only guide placement:
 * discovery owns coverage, so every discovered file runs on exactly one shard,
 * and a file without a measurement counts as the median measured file.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

/** One-based shard of the browser suite. */
export type AppShard = { readonly current: number; readonly total: number };

/** Measured seconds per spec file, keyed by its path from the package root. */
export type ShardWeights = Readonly<Record<string, number>>;

/** Directory of the browser specs, from the package root. */
export const specDirectory = "src/_tests_";

/** Committed measurements, from the package root. */
export const weightsFile = `${specDirectory}/browser-shard-weights.json`;

/** Read `MKC_APP_SHARD`; an empty or missing value selects no shard. */
export function parseAppShard(value: string | undefined): AppShard | undefined {
  if (!value) return undefined;
  const match = /^([0-9]+)\/([0-9]+)$/.exec(value);
  const current = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (
    match?.[0] !== value ||
    !Number.isInteger(current) ||
    !Number.isInteger(total) ||
    current < 1 ||
    current > total ||
    total > 0xffff_ffff
  ) {
    throw new Error("MKC_APP_SHARD must be <n>/<total>, where 1 <= n <= total");
  }
  return { current, total };
}

/** Every browser spec under the package root, as a `/`-separated path. */
export function discoverSpecFiles(packageRoot: string): string[] {
  return readdirSync(join(packageRoot, specDirectory), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".spec.ts"))
    .map((file) => `${specDirectory}/${file.split(sep).join("/")}`)
    .sort(compareFiles);
}

/** Read the committed measurements of a package root. */
export function readShardWeights(packageRoot: string): ShardWeights {
  return parseShardWeights(
    JSON.parse(readFileSync(join(packageRoot, weightsFile), "utf8")),
  );
}

/** Accept only an object of finite, non-negative seconds. */
export function parseShardWeights(value: unknown): ShardWeights {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${weightsFile} must hold an object of seconds per file`);
  const weights: Record<string, number> = {};
  for (const [file, seconds] of Object.entries(value)) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0)
      throw new Error(`${weightsFile} gives ${file} no valid seconds`);
    weights[file] = seconds;
  }
  return weights;
}

/** The files of one shard, sorted by path. */
export function selectShardFiles(
  files: readonly string[],
  weights: ShardWeights,
  shard: AppShard,
): string[] {
  const measured = Object.values(weights).sort((left, right) => left - right);
  const fallback = measured[Math.floor(measured.length / 2)] ?? 1;
  const costed = files.map((file) => ({
    file,
    seconds: weights[file] ?? fallback,
  }));
  costed.sort(
    (left, right) =>
      right.seconds - left.seconds || compareFiles(left.file, right.file),
  );
  const shards = Array.from(
    { length: shard.total },
    (): { files: string[]; seconds: number } => ({ files: [], seconds: 0 }),
  );
  for (const { file, seconds } of costed) {
    const lightest = shards.reduce((best, candidate) =>
      candidate.seconds < best.seconds ? candidate : best,
    );
    lightest.files.push(file);
    lightest.seconds += seconds;
  }
  return shards[shard.current - 1].files.sort(compareFiles);
}

/**
 * Sum the seconds per spec file that Playwright's `list` reporter printed,
 * for example in the CI logs of the browser shards.
 */
export function measuredSeconds(log: string): Record<string, number> {
  const line =
    /\] › (\S+?\.spec\.ts):\d+:\d+ › .*\((\d+(?:\.\d+)?)(ms|s|m)\)\s*$/;
  const seconds: Record<string, number> = {};
  for (const text of log.split("\n")) {
    const match = line.exec(text);
    if (!match) continue;
    const scale = match[3] === "ms" ? 0.001 : match[3] === "m" ? 60 : 1;
    seconds[match[1]] = (seconds[match[1]] ?? 0) + Number(match[2]) * scale;
  }
  return seconds;
}

function compareFiles(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
