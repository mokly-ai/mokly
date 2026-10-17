export function validateUniqueStrings(values, label, allowEmpty) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0))
    throw new Error(`${label} is empty or missing`);
  if (values.some((value) => typeof value !== "string" || value.length === 0))
    throw new Error(`${label} has an invalid value`);
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicate values`);
}

export function validateShard(shard) {
  if (shard === null) return;
  if (
    !Number.isSafeInteger(shard?.index) ||
    !Number.isSafeInteger(shard?.total) ||
    shard.index < 1 ||
    shard.total < 1 ||
    shard.index > shard.total
  )
    throw new Error("invalid report shard");
}

export function validateRuntime(runtime, nodeVersion) {
  const match = /^node-(\d+)(?:\.(\d+)\.(\d+))?$/.exec(runtime);
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion);
  if (!match || !version || match[1] !== version[1])
    throw new Error(`runtime ${runtime} does not match Node ${nodeVersion}`);
  if (
    match[2] !== undefined &&
    (match[2] !== version[2] || match[3] !== version[3])
  )
    throw new Error(`runtime ${runtime} does not match Node ${nodeVersion}`);
}

export function requireSameValues(left, right, label) {
  if (sorted(left).join("\n") !== sorted(right).join("\n"))
    throw new Error(`${label} do not match`);
}

export function requireSameTestIds(left, right, label) {
  requireSameValues(
    left.map((entry) => entry.id),
    right.map((entry) => entry.id),
    label,
  );
}

export function requireSubset(values, complete, label) {
  const inventory = new Set(complete);
  if (values.some((value) => !inventory.has(value)))
    throw new Error(`${label} contain an unexpected value`);
}

export function requireDisjointComplete(groups, complete, label) {
  for (const group of groups)
    if (group.length === 0) throw new Error(`${label} contain an empty shard`);
  const union = groups.flat();
  if (new Set(union).size !== union.length)
    throw new Error(`${label} contain duplicate values`);
  requireSameValues(union, complete, `${label} union`);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
