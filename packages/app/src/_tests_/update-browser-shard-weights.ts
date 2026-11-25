/**
 * Rewrite the committed browser shard weights from the logs of one complete
 * browser run, for example the CI logs of every App checks job:
 * `npx tsx src/_tests_/update-browser-shard-weights.ts {log}...`, run from
 * the package root.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { measuredSeconds, weightsFile } from "./browser-shards";

const logs = process.argv.slice(2);
if (!logs.length)
  throw new Error("Pass the logs of every shard of one complete browser run");
const totals: Record<string, number> = {};
for (const log of logs)
  for (const [file, seconds] of Object.entries(
    measuredSeconds(readFileSync(log, "utf8")),
  ))
    totals[file] = (totals[file] ?? 0) + seconds;
const weights = Object.fromEntries(
  Object.entries(totals)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([file, seconds]) => [file, Math.round(seconds * 10) / 10]),
);
writeFileSync(
  join(process.cwd(), weightsFile),
  JSON.stringify(weights, null, 2) + "\n",
);
process.stdout.write(
  `Wrote ${Object.keys(weights).length} spec weights to ${weightsFile}\n`,
);
