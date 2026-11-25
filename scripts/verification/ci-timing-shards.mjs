import { matchesPattern } from "./ci-timing-budgets.mjs";
import { cell, formatSeconds, jobCell } from "./ci-timing-format.mjs";

const REFRESH_COMMAND = "npm run ci:refresh-shard-weights";

/**
 * Narrow the `shardGroups` field of the budget file. Each group has a name,
 * the job-name patterns of its shards, the patterns of the matching jobs that
 * run other work, a spread budget in minutes, and `weighted`, which is false
 * for a group that no weight file balances.
 */
export function parseShardGroups(value) {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("shardGroups must list at least one group");
  return value.map((group, index) => {
    const at = `shardGroups[${index}]`;
    if (!isRecord(group) || typeof group.name !== "string" || !group.name)
      throw new Error(`${at} needs a name`);
    const { patterns, exclude = [], spreadMinutes, weighted = true } = group;
    if (!isPatternList(patterns) || patterns.length === 0)
      throw new Error(`${at}.patterns must list at least one job-name pattern`);
    if (!isPatternList(exclude))
      throw new Error(`${at}.exclude must list job-name patterns`);
    if (
      typeof spreadMinutes !== "number" ||
      !Number.isFinite(spreadMinutes) ||
      spreadMinutes <= 0
    )
      throw new Error(`${at}.spreadMinutes must be a positive number`);
    if (typeof weighted !== "boolean")
      throw new Error(`${at}.weighted must be true or false`);
    return { name: group.name, patterns, exclude, spreadMinutes, weighted };
  });
}

/**
 * Compare the passed shards of each group within this run. The spread is
 * the run time of the slowest passed shard minus that of the fastest one.
 * A shard that did not pass, or that has no run time, is left out. A group
 * with fewer than two passed shards has no spread.
 */
export function evaluateShards(rows, groups) {
  return groups.map((group) => {
    const matches = (patterns, row) =>
      patterns.some((pattern) => matchesPattern(row.job.name, pattern));
    const matched = rows.filter(
      (row) => matches(group.patterns, row) && !matches(group.exclude, row),
    );
    const passed = matched
      .filter((row) => row.job.conclusion === "success" && row.seconds !== null)
      .sort(
        (left, right) =>
          left.seconds - right.seconds ||
          left.job.name.localeCompare(right.job.name),
      );
    if (passed.length < 2)
      return { group, shards: matched.length, passed: passed.length };
    const fastest = passed[0];
    const slowest = passed.at(-1);
    const spreadSeconds = slowest.seconds - fastest.seconds;
    const overSeconds = spreadSeconds - group.spreadMinutes * 60;
    return {
      group,
      shards: matched.length,
      passed: passed.length,
      fastest,
      slowest,
      spreadSeconds,
      overSeconds: overSeconds > 0 ? overSeconds : null,
    };
  });
}

/** One warning for each group whose spread passes its budget. */
export function shardWarnings(shards) {
  return (shards ?? [])
    .filter((row) => row.overSeconds)
    .map(
      (row) =>
        `The ${row.group.name} shards spread ${formatSeconds(row.spreadSeconds)}, above the ${row.group.spreadMinutes}m budget: ${row.slowest.job.name} ran ${formatSeconds(row.slowest.seconds)} and ${row.fastest.job.name} ran ${formatSeconds(row.fastest.seconds)}. ${hint(row.group)}`,
    );
}

/** The Markdown section of the shard balance, or a line that it did not run. */
export function shardLines(shards) {
  const lines = ["### Shard balance", ""];
  if (!shards) return [...lines, "The shard balance was not checked."];
  lines.push(
    "The spread of a group is the run time of its slowest passed shard minus that of its fastest passed shard in this run.",
    "",
    "| Group | Passed | Fastest | Slowest | Spread | Budget | Status |",
    "| --- | ---: | --- | --- | ---: | ---: | --- |",
    ...shards.map((row) => `| ${shardRow(row).join(" | ")} |`),
  );
  if (shards.some((row) => row.overSeconds && row.group.weighted))
    lines.push(
      "",
      `Refresh the weights from the newest green \`main\` runs with \`${REFRESH_COMMAND}\`.`,
    );
  return lines;
}

function shardRow(row) {
  const name = row.group.weighted
    ? cell(row.group.name)
    : `${cell(row.group.name)} (unweighted)`;
  const budget = `${row.group.spreadMinutes}m`;
  const passed = `${row.passed} of ${row.shards}`;
  if (row.spreadSeconds === undefined)
    return [name, passed, "–", "–", "–", budget, tooFew(row)];
  return [
    name,
    passed,
    `${jobCell(row.fastest.job)}, ${formatSeconds(row.fastest.seconds)}`,
    `${jobCell(row.slowest.job)}, ${formatSeconds(row.slowest.seconds)}`,
    formatSeconds(row.spreadSeconds),
    budget,
    row.overSeconds ? `⚠️ over by ${formatSeconds(row.overSeconds)}` : "within",
  ];
}

function tooFew(row) {
  return row.shards === 0 ? "not run" : "fewer than 2 passed shards";
}

function hint(group) {
  return group.weighted
    ? `Run \`${REFRESH_COMMAND}\` to refresh the shard weights.`
    : "No weight file balances this group, so move tests between its spec files or change its shard count.";
}

function isPatternList(value) {
  return (
    Array.isArray(value) &&
    value.every((pattern) => typeof pattern === "string" && pattern)
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
