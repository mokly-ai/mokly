/** Validate one presentation loader's generation and snapshot subtrees. */

/** A snapshot subtree that one loader may read. */
export type SnapshotSide = "after" | "before";

/** The non-empty snapshot-side set configured for one loader. */
export type SnapshotSides = readonly [SnapshotSide, ...SnapshotSide[]];

/** Validate and deduplicate the loader's configured snapshot sides. */
export function snapshotSideSet(
  sides: SnapshotSides,
): ReadonlySet<SnapshotSide> {
  if (sides.length === 0)
    throw new TypeError("A loader requires at least one snapshot side.");
  const result = new Set<SnapshotSide>();
  for (const side of sides) {
    if (side !== "after" && side !== "before")
      throw new TypeError("A loader received an unsupported snapshot side.");
    result.add(side);
  }
  return result;
}

/** Resolve and validate the one immutable generation owned by a loader. */
export function snapshotGeneration(
  value: string | URL,
  baseUrl: string | URL,
  failureCopy: string,
): URL {
  let generation: URL;
  let source: URL;
  try {
    generation = new URL(value);
    source = new URL(baseUrl);
  } catch {
    return unavailable(failureCopy);
  }
  if (
    !["http:", "https:"].includes(generation.protocol) ||
    generation.username ||
    generation.password ||
    generation.search ||
    generation.hash ||
    generation.origin !== source.origin ||
    !generation.pathname.endsWith("/")
  )
    return unavailable(failureCopy);
  return generation;
}

/** Accept only a non-root address beneath one configured side prefix. */
export function confinedSnapshot(
  value: string,
  generation: URL,
  prefixes: readonly URL[],
  failureCopy: string,
): URL {
  let snapshot: URL;
  try {
    snapshot = new URL(value);
  } catch {
    return unavailable(failureCopy);
  }
  if (
    snapshot.origin !== generation.origin ||
    snapshot.username ||
    snapshot.password ||
    snapshot.search ||
    snapshot.hash ||
    !prefixes.some(
      (prefix) =>
        snapshot.pathname.startsWith(prefix.pathname) &&
        snapshot.pathname !== prefix.pathname,
    )
  )
    return unavailable(failureCopy);
  return snapshot;
}

function unavailable(message: string): never {
  throw new Error(message);
}
