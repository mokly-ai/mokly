/**
 * Rewrite the committed browser shard weights from the logs of one complete
 * browser run, for example the CI logs of every App checks job:
 * `npx tsx src/_tests_/update-browser-shard-weights.ts {log}...`, run from
 * the package root. A measured spec takes its new seconds. A current spec
 * that the logs do not measure keeps its committed seconds, and a removed
 * spec loses its entry.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  discoverSpecFiles,
  measuredSeconds,
  readShardWeights,
  weightsFile,
} from "./browser-shards";

const root = process.cwd();
const logs = process.argv.slice(2);
if (!logs.length)
  throw new Error("Pass the logs of every shard of one complete browser run");
const measured: Record<string, number> = {};
for (const log of logs)
  for (const [file, seconds] of Object.entries(
    measuredSeconds(readFileSync(log, "utf8")),
  ))
    measured[file] = (measured[file] ?? 0) + seconds;
const committed = readShardWeights(root);
const weights: Record<string, number> = {};
let kept = 0;
for (const file of discoverSpecFiles(root)) {
  const seconds = measured[file] ?? committed[file];
  if (seconds === undefined) continue;
  if (measured[file] === undefined) kept += 1;
  weights[file] = Math.round(seconds * 10) / 10;
}
writeFileSync(join(root, weightsFile), JSON.stringify(weights, null, 2) + "\n");
process.stdout.write(
  `Wrote ${Object.keys(weights).length} spec weights to ${weightsFile}; ${kept} kept their committed seconds\n`,
);
