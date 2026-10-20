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
  const partitions = Array.from(
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
