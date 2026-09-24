import { MoklyError } from "../errors.js";

/** Validate legacy collection edges before dropping their records from a baseline. */
export function validateHistoricalCollections(
  entries: readonly Record<string, unknown>[],
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  const parents = new Map<string, string>();
  const edges = new Map<string, readonly string[]>();
  for (const entry of entries) {
    if (entry.kind !== "collection") continue;
    const id = entry.id as string;
    const children = entry.childIds as string[];
    const seen = new Set<string>();
    for (const childId of children) {
      if (seen.has(childId))
        failure(id, `child id "${childId}" is listed more than once`);
      seen.add(childId);
      if (!byId.has(childId)) failure(id, `unknown child id: ${childId}`);
      const previous = parents.get(childId);
      if (previous && previous !== id) {
        failure(
          id,
          `child ${childId} is already claimed by collection ${previous}`,
        );
      }
      parents.set(childId, id);
      const child = byId.get(childId);
      if (child?.kind === "screen" && typeof child.variantOf === "string") {
        failure(id, `collection ${id} claims variant ${childId}`);
      }
    }
    edges.set(
      id,
      children.filter((childId) => byId.get(childId)?.kind === "collection"),
    );
  }
  const complete = new Set<string>();
  const active = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    if (active.has(id))
      failure(id, `collection cycle: ${[...path, id].join(" -> ")}`);
    if (complete.has(id)) return;
    active.add(id);
    for (const childId of edges.get(id) ?? []) visit(childId, [...path, id]);
    active.delete(id);
    complete.add(id);
  };
  for (const id of edges.keys()) visit(id, []);
}

function failure(id: string, message: string): never {
  throw new MoklyError(
    "manifest-invalid",
    `${id} has an invalid relationship: ${message}`,
  );
}
