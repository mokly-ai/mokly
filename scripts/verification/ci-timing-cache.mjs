import { cell } from "./ci-timing-format.mjs";
import { githubJson } from "./ci-timing-jobs.mjs";

const PAGE_SIZE = 100;
const PAGE_LIMIT = 10;
/** Sizes are decimal: 1 GB is 10^9 bytes. */
const GIGABYTE = 1e9;
/** GitHub evicts the least recently used entries above this repository total. */
const LIMIT_GIGABYTES = 10;
/** Only workflow runs on this ref save a cache. */
export const SAVING_REF = "refs/heads/main";

/** Narrow the `cache` field of the budget file. */
export function parseCacheBudget(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("cache must hold gigabytes and largestEntries");
  const { gigabytes, largestEntries } = value;
  if (
    typeof gigabytes !== "number" ||
    !Number.isFinite(gigabytes) ||
    gigabytes <= 0
  )
    throw new Error("cache.gigabytes must be a positive number");
  if (!Number.isInteger(largestEntries) || largestEntries < 0)
    throw new Error(
      "cache.largestEntries must be a whole number of zero or more",
    );
  return { gigabytes, largestEntries };
}

/**
 * Read every Actions cache entry of the repository, largest first, page by
 * page. Resolve to one body in the shape of a single API page.
 */
export async function fetchCaches(request) {
  const caches = [];
  let totalCount = 0;
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const path = `/repos/${request.repository}/actions/caches?sort=size_in_bytes&direction=desc&per_page=${PAGE_SIZE}&page=${page}`;
    const body = await githubJson(request, path);
    const entries = isRecord(body) ? body.actions_caches : null;
    if (!Array.isArray(entries))
      throw new Error(`GitHub GET ${path} returned no actions_caches array`);
    caches.push(...entries);
    totalCount = typeof body.total_count === "number" ? body.total_count : 0;
    if (entries.length < PAGE_SIZE || caches.length >= totalCount) break;
  }
  return { total_count: totalCount, actions_caches: caches };
}

/**
 * Sum the entries of one cache list and compare the total with the budget.
 * An entry without a key, a ref, or a size is left out and named in `issues`.
 */
export function evaluateCache(body, budget) {
  const raw = isRecord(body) ? body.actions_caches : null;
  if (!Array.isArray(raw))
    throw new Error("the cache list must hold an actions_caches array");
  const issues = [];
  const entries = [];
  for (const [index, value] of raw.entries()) {
    const entry = parseEntry(value);
    if (entry) entries.push(entry);
    else issues.push(`cache entry ${index} has no key, ref, or size`);
  }
  const totalCount =
    typeof body.total_count === "number" ? body.total_count : raw.length;
  if (totalCount > raw.length)
    issues.push(
      `The cache list holds ${totalCount} entries and the report read ${raw.length}, so the cache total covers only those.`,
    );
  entries.sort(
    (left, right) =>
      right.bytes - left.bytes || left.key.localeCompare(right.key),
  );
  const totalBytes = sum(entries);
  const budgetBytes = budget.gigabytes * GIGABYTE;
  return {
    totalBytes,
    count: entries.length,
    budgetGigabytes: budget.gigabytes,
    overBytes: totalBytes > budgetBytes ? totalBytes - budgetBytes : null,
    largest: entries.slice(0, budget.largestEntries),
    otherRefs: entries.filter((entry) => entry.ref !== SAVING_REF),
    issues,
  };
}

/** The warning texts of one cache report. They never fail the step. */
export function cacheWarnings(cache) {
  if (!cache) return [];
  const warnings = [];
  if (cache.overBytes !== null)
    warnings.push(
      `The Actions cache holds ${size(cache.totalBytes)}, above its ${cache.budgetGigabytes} GB budget. GitHub evicts entries above ${LIMIT_GIGABYTES} GB.`,
    );
  if (cache.otherRefs.length > 0)
    warnings.push(
      `${cache.otherRefs.length} Actions cache entries, ${size(sum(cache.otherRefs))}, come from refs other than ${SAVING_REF}, the only ref that saves a cache.`,
    );
  return warnings;
}

/** The Markdown lines of the cache section of the job summary. */
export function cacheLines(cache) {
  const lines = ["### Actions cache", ""];
  if (!cache) return [...lines, "The Actions cache was not read."];
  const over =
    cache.overBytes === null
      ? "within budget"
      : `⚠️ over by ${size(cache.overBytes)}`;
  lines.push(
    `The cache holds ${size(cache.totalBytes)} in ${cache.count} entries, budget ${cache.budgetGigabytes} GB, ${over}. GitHub evicts the least recently used entries above ${LIMIT_GIGABYTES} GB.`,
  );
  if (cache.largest.length > 0)
    lines.push("", "Largest entries:", "", ...entryTable(cache.largest));
  lines.push("");
  if (cache.otherRefs.length === 0)
    lines.push(`Every entry comes from ${SAVING_REF}.`);
  else
    lines.push(
      `⚠️ Entries from refs other than ${SAVING_REF}:`,
      "",
      ...entryTable(cache.otherRefs),
    );
  return lines;
}

function entryTable(entries) {
  return [
    "| Entry | Ref | Size | Last used |",
    "| --- | --- | ---: | --- |",
    ...entries.map(
      (entry) =>
        `| ${cell(entry.key)} | ${cell(entry.ref)} | ${size(entry.bytes)} | ${entry.lastUsed ?? "–"} |`,
    ),
  ];
}

function parseEntry(value) {
  if (!isRecord(value)) return null;
  const { key, ref, size_in_bytes: bytes } = value;
  if (typeof key !== "string" || typeof ref !== "string") return null;
  if (!Number.isInteger(bytes) || bytes < 0) return null;
  const lastUsedMs = Date.parse(String(value.last_accessed_at));
  const lastUsed = Number.isNaN(lastUsedMs)
    ? null
    : `${new Date(lastUsedMs).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return { key, ref, bytes, lastUsed };
}

/** Bytes as decimal gigabytes with two decimals, or megabytes below 1 GB. */
function size(bytes) {
  return bytes >= GIGABYTE
    ? `${(bytes / GIGABYTE).toFixed(2)} GB`
    : `${Math.round(bytes / 1e6)} MB`;
}

function sum(entries) {
  return entries.reduce((total, entry) => total + entry.bytes, 0);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
