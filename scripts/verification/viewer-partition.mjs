import weights from "./viewer-shard-weights.json" with { type: "json" };

/**
 * Assign whole discovered Node test files to one shard by measured duration.
 * Measurements guide placement only; discovery owns coverage. A file without
 * a measurement uses the median measured duration. The selected files keep
 * their discovery order.
 */
export function selectViewerShard(files, shard, costs = weights) {
  const measured = Object.values(costs).sort((left, right) => left - right);
  const fallback = measured[Math.floor(measured.length / 2)] ?? 1;
  const ordered = files
    .map((file) => ({ file, cost: costs[file] ?? fallback }))
    .sort(
      (left, right) =>
        right.cost - left.cost || compareFiles(left.file, right.file),
    );
  const partitions = Array.from({ length: shard.total }, () => ({
    files: new Set(),
    cost: 0,
  }));
  for (const entry of ordered) {
    const selected = partitions.reduce((best, candidate) =>
      candidate.cost < best.cost ||
      (candidate.cost === best.cost && candidate.files.size < best.files.size)
        ? candidate
        : best,
    );
    selected.files.add(entry.file);
    selected.cost += entry.cost;
  }
  const selected = partitions[shard.index - 1].files;
  return files.filter((file) => selected.has(file));
}

function compareFiles(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
