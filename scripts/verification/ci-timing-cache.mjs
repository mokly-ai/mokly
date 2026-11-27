import { cell } from "./ci-timing-format.mjs";
import { githubJson } from "./ci-timing-jobs.mjs";

const PAGE_SIZE = 100;
const PAGE_LIMIT = 10;
/** Sizes are decimal: 1 GB is 10^9 bytes. */
const GIGABYTE = 1e9;
/** GitHub evicts the least recently used entries above this repository total. */
const LIMIT_GIGABYTES = 10;
/** Only workflow runs on this ref save a cache. */
const SAVING_REF = "refs/heads/main";

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
 * page. Resolve to one body in the shape of a single API page. The body is
 * `truncated` when the page limit stopped the read before the last page.
 */
export async function fetchCaches(request) {
  const pages = [];
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const path = `/repos/${request.repository}/actions/caches?sort=size_in_bytes&direction=desc&per_page=${PAGE_SIZE}&page=${page}`;
    const body = await githubJson(request, path);
    if (!isRecord(body) || !Array.isArray(body.actions_caches))
      throw new Error(`GitHub GET ${path} returned no actions_caches array`);
    pages.push(body);
    const read = pages.reduce((n, p) => n + p.actions_caches.length, 0);
    if (body.actions_caches.length < PAGE_SIZE) return mergePages(pages);
    if (typeof body.total_count === "number" && read >= body.total_count)
      return mergePages(pages);
  }
  return { ...mergePages(pages), truncated: true };
}

/**
 * Narrow a saved cache list: one API page, or the array of pages that
 * `gh api --paginate --slurp` writes.
 */
export function savedCaches(value) {
  if (!Array.isArray(value)) return value;
  if (
    !value.every((page) => isRecord(page) && Array.isArray(page.actions_caches))
  )
    throw new Error("each saved cache page must hold an actions_caches array");
  return mergePages(value);
}

/**
 * Sum the entries of one cache list and compare the total with the budget.
 * An entry without a key, a ref, or a size is left out and named in
 * `issues`. A list that misses entries gives lower bounds: it proves an
 * overrun or an entry from another ref, but never that none exists.
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
  const listed =
    typeof body.total_count === "number"
      ? Math.max(body.total_count, raw.length)
      : null;
  const complete =
    listed === raw.length &&
    body.truncated !== true &&
    entries.length === raw.length;
  if (!complete)
    issues.push(
      `The report read ${entries.length} of ${listed ?? "an unknown number of"} cache entries, so the cache total is a lower bound.`,
    );
  entries.sort(
    (left, right) =>
      right.bytes - left.bytes || left.key.localeCompare(right.key),
  );
  const totalBytes = sum(entries);
  const budgetBytes = budget.gigabytes * GIGABYTE;
  return {
    complete,
    totalBytes,
    count: entries.length,
    listed,
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
  const atLeast = cache.complete ? "" : "at least ";
  if (cache.overBytes !== null)
    warnings.push(
      `The Actions cache holds ${atLeast}${size(cache.totalBytes)}, above its ${cache.budgetGigabytes} GB budget. GitHub evicts entries above ${LIMIT_GIGABYTES} GB.`,
    );
  const others = cache.otherRefs.length;
  if (others > 0)
    warnings.push(
      `${others} Actions cache ${others === 1 ? "entry" : "entries"}, ${size(sum(cache.otherRefs))}, ${others === 1 ? "comes" : "come"} from refs other than ${SAVING_REF}, the only ref that saves a cache.`,
    );
  return warnings;
}

/** The Markdown lines of the cache section of the job summary. */
export function cacheLines(cache) {
  const lines = ["### Actions cache", ""];
  if (!cache) return [...lines, "The Actions cache was not read."];
  lines.push(`${totalLine(cache)} ${budgetLine(cache)}`);
  if (cache.largest.length > 0)
    lines.push("", "Largest entries:", "", ...entryTable(cache.largest));
  lines.push("");
  if (cache.otherRefs.length > 0)
    lines.push(
      `⚠️ Entries from refs other than ${SAVING_REF}:`,
      "",
      ...entryTable(cache.otherRefs),
    );
  else if (cache.complete) lines.push(`Every entry comes from ${SAVING_REF}.`);
  else
    lines.push(
      `Every entry that the report read comes from ${SAVING_REF}. The other entries were not checked.`,
    );
  return lines;
}

function totalLine(cache) {
  if (cache.complete)
    return `The cache holds ${size(cache.totalBytes)} in ${entries(cache.count)}.`;
  const of = cache.listed === null ? "" : ` of ${cache.listed}`;
  return `⚠️ The report read ${cache.count}${of} entries. They hold ${size(cache.totalBytes)}, so the cache holds at least that.`;
}

function budgetLine(cache) {
  const budget = `Budget ${cache.budgetGigabytes} GB`;
  const eviction = `GitHub evicts the least recently used entries above ${LIMIT_GIGABYTES} GB.`;
  if (cache.overBytes !== null)
    return `${budget}, ⚠️ over by ${cache.complete ? "" : "at least "}${size(cache.overBytes)}. ${eviction}`;
  if (cache.complete) return `${budget}, within budget. ${eviction}`;
  return `${budget}, not known to be within it. ${eviction}`;
}

function entries(count) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

function mergePages(pages) {
  const counts = pages.map((page) => page.total_count);
  return {
    total_count: counts.find((count) => typeof count === "number") ?? null,
    actions_caches: pages.flatMap((page) => page.actions_caches),
  };
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
