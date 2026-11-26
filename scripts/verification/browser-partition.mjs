import weights from "./browser-shard-weights.json" with { type: "json" };
import { BROWSER_SHARD_SHARE_LIMIT } from "./shard-balance.mjs";

/**
 * Wall time that the copied static example build adds to global setup on one
 * hosted shard, measured as 93 s against about 42 s. Placement charges it once
 * to each shard that builds it.
 */
const COPIED_HOST_SETUP_MS = 50_000;

/**
 * Assign the discovered whole specs by measured cost, subject to the existing
 * test-count cap. Measurements guide placement only; discovery owns coverage.
 * New specs use the median per-test cost until a later measurement covers them.
 * Specs go in order of their larger share of the total cost or of the total
 * test count, so the specs that fill the count cap first are placed early.
 * Specs that need the copied static host go first onto the fewest shards that
 * keep the longest shard shortest, so the other shards skip that build.
 */
export function selectBrowserShard(
  inventory,
  shard,
  costs = weights,
  copiedSpecs = new Set(),
) {
  const groups = new Map(
    inventory.files.map((file) => [file, { file, tests: [] }]),
  );
  for (const test of inventory.tests)
    groups.get(test.specFile).tests.push(test);
  const measured = Object.values(costs).sort((left, right) => left - right);
  const fallback = measured[Math.floor(measured.length / 2)] ?? 1;
  const specs = [...groups.values()].map((group) => ({
    ...group,
    cost: (costs[group.file] ?? fallback) * group.tests.length,
    copied: copiedSpecs.has(group.file),
  }));
  const totalCost = specs.reduce((sum, spec) => sum + spec.cost, 0) || 1;
  const share = (spec) =>
    Math.max(spec.cost / totalCost, spec.tests.length / inventory.tests.length);
  specs.sort(
    (left, right) =>
      share(right) - share(left) ||
      right.cost - left.cost ||
      right.tests.length - left.tests.length ||
      compareFiles(left.file, right.file),
  );
  const limit = Math.ceil(
    (inventory.tests.length / shard.total) * BROWSER_SHARD_SHARE_LIMIT,
  );
  const count = Math.min(shard.total, specs.length);
  const choices = specs.some((spec) => spec.copied)
    ? Array.from({ length: count }, (_, index) => index + 1)
    : [0];
  let partitions;
  let longest = Infinity;
  for (const copiedShards of choices) {
    const candidate = placeSpecs(specs, count, limit, copiedShards);
    if (candidate.some((partition) => partition.tests.length > limit)) {
      partitions ??= candidate;
      continue;
    }
    const cost = Math.max(...candidate.map((partition) => partition.cost));
    if (cost < longest) [partitions, longest] = [candidate, cost];
  }
  if (partitions.some((partition) => partition.tests.length > limit))
    partitions = repairCapacity(specs, count, limit) ?? partitions;
  const selected = partitions[shard.index - 1];
  if (!selected?.tests.length)
    throw new Error("Playwright test discovery was empty");
  return {
    files: selected.files.sort(compareFiles),
    tests: selected.tests.sort((left, right) =>
      compareFiles(left.id, right.id),
    ),
    copiedHost: selected.files.some((file) => copiedSpecs.has(file)),
  };
}

/**
 * Place copied-host specs on the first `copiedShards` shards, each charged
 * the copied build once, then every other spec on the least-cost shard.
 */
function placeSpecs(specs, count, limit, copiedShards) {
  const partitions = Array.from({ length: count }, (_, index) => ({
    files: [],
    tests: [],
    cost: index < copiedShards ? COPIED_HOST_SETUP_MS : 0,
    copiedHost: false,
  }));
  const place = (spec, pool) => {
    const eligible = pool.filter(
      (partition) => partition.tests.length + spec.tests.length <= limit,
    );
    // An oversized whole spec still runs. The existing evidence cap reports it.
    const candidates = eligible.length ? eligible : pool;
    const selected = candidates.reduce((best, candidate) =>
      candidate.cost < best.cost ||
      (candidate.cost === best.cost &&
        candidate.tests.length < best.tests.length)
        ? candidate
        : best,
    );
    selected.files.push(spec.file);
    selected.tests.push(...spec.tests);
    selected.cost += spec.cost;
    selected.copiedHost ||= spec.copied;
  };
  const copiedPool = partitions.slice(0, copiedShards);
  for (const spec of specs) if (spec.copied) place(spec, copiedPool);
  for (const partition of copiedPool)
    if (!partition.copiedHost) partition.cost -= COPIED_HOST_SETUP_MS;
  for (const spec of specs) if (!spec.copied) place(spec, partitions);
  return partitions;
}

/** Search only when greedy cost placement misses a feasible count packing. */
function repairCapacity(specs, total, limit) {
  if (specs.some((spec) => spec.tests.length > limit)) return undefined;
  const ordered = [...specs].sort(
    (left, right) =>
      right.tests.length - left.tests.length ||
      right.cost - left.cost ||
      compareFiles(left.file, right.file),
  );
  const bins = Array.from({ length: total }, () => ({
    specs: [],
    count: 0,
    cost: 0,
  }));
  const rejected = new Set();
  const place = (index) => {
    if (index === ordered.length) return bins.every((bin) => bin.count > 0);
    const remaining = ordered.length - index;
    const empty = bins.filter((bin) => bin.count === 0).length;
    if (remaining < empty) return false;
    const key = `${index}:${bins
      .map((bin) => bin.count)
      .sort((a, b) => a - b)
      .join(",")}`;
    if (rejected.has(key)) return false;
    const spec = ordered[index];
    const seenCounts = new Set();
    const candidates = [...bins].sort((left, right) => left.cost - right.cost);
    for (const bin of candidates) {
      if (
        bin.count + spec.tests.length > limit ||
        seenCounts.has(bin.count) ||
        (remaining === empty && bin.count > 0)
      )
        continue;
      seenCounts.add(bin.count);
      bin.specs.push(spec);
      bin.count += spec.tests.length;
      bin.cost += spec.cost;
      if (place(index + 1)) return true;
      bin.specs.pop();
      bin.count -= spec.tests.length;
      bin.cost -= spec.cost;
    }
    rejected.add(key);
    return false;
  };
  return place(0)
    ? bins.map((bin) => ({
        files: bin.specs.map((spec) => spec.file),
        tests: bin.specs.flatMap((spec) => spec.tests),
        cost: bin.cost,
      }))
    : undefined;
}

/** Exact file filters keep selected specs whole on POSIX and Windows paths. */
export function browserFileArguments(files) {
  return files.map(
    (file) =>
      `(?:^|[/\\\\])${file
        .split("/")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[/\\\\]")}$`,
  );
}

function compareFiles(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
