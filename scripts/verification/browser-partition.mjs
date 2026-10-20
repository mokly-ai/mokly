import weights from "./browser-shard-weights.json" with { type: "json" };
import { BROWSER_SHARD_SHARE_LIMIT } from "./shard-balance.mjs";

/**
 * Assign the discovered whole specs by measured cost, subject to the existing
 * test-count cap. Measurements guide placement only; discovery owns coverage.
 * New specs use the median per-test cost until a later measurement covers them.
 */
export function selectBrowserShard(inventory, shard, costs = weights) {
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
  }));
  specs.sort(
    (left, right) =>
      right.cost - left.cost ||
      right.tests.length - left.tests.length ||
      compareFiles(left.file, right.file),
  );
  const limit = Math.ceil(
    (inventory.tests.length / shard.total) * BROWSER_SHARD_SHARE_LIMIT,
  );
  let partitions = Array.from(
    { length: Math.min(shard.total, specs.length) },
    () => ({ files: [], tests: [], cost: 0 }),
  );
  for (const spec of specs) {
    const eligible = partitions.filter(
      (partition) => partition.tests.length + spec.tests.length <= limit,
    );
    // An oversized whole spec still runs. The existing evidence cap reports it.
    const candidates = eligible.length ? eligible : partitions;
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
  }
  if (partitions.some((partition) => partition.tests.length > limit))
    partitions = repairCapacity(specs, partitions.length, limit) ?? partitions;
  const selected = partitions[shard.index - 1];
  if (!selected?.tests.length)
    throw new Error("Playwright test discovery was empty");
  return {
    files: selected.files.sort(compareFiles),
    tests: selected.tests.sort((left, right) =>
      compareFiles(left.id, right.id),
    ),
  };
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
