/** Entry fields needed to analyze collection membership. */
export interface HierarchyEntry {
  childIds?: unknown;
  id: string;
  kind: string;
  title: string;
}

/** Structural collection-forest violation. */
export interface HierarchyIssue<T extends HierarchyEntry> {
  code:
    | "collection-cycle"
    | "duplicate-child"
    | "missing-child"
    | "multiple-parents";
  entry: T;
  message: string;
}

/** Canonical collection forest derived from entry relationships. */
export interface CatalogueHierarchy<T extends HierarchyEntry> {
  ancestorsById: ReadonlyMap<string, readonly T[]>;
  byId: ReadonlyMap<string, T>;
  childrenById: ReadonlyMap<string, readonly T[]>;
  parentById: ReadonlyMap<string, T>;
  roots: readonly T[];
}

/** Hierarchy data plus any structural issues found while deriving it. */
export interface HierarchyAnalysis<T extends HierarchyEntry> {
  hierarchy: CatalogueHierarchy<T>;
  issues: readonly HierarchyIssue<T>[];
}

/** Derive a cycle-guarded collection forest and deterministic diagnostics. */
export function analyzeHierarchy<T extends HierarchyEntry>(
  entries: readonly T[],
): HierarchyAnalysis<T> {
  const ordered = [...entries].sort(compareEntries);
  const byId = new Map<string, T>();
  for (const entry of ordered) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }

  const collections = [...byId.values()].filter(isCollection);
  const childrenById = new Map<string, readonly T[]>();
  const parentById = new Map<string, T>();
  const collectionEdges = new Map<string, readonly string[]>();
  const issues: HierarchyIssue<T>[] = [];

  for (const collection of collections) {
    const seen = new Set<string>();
    const children: T[] = [];
    const collectionChildren: string[] = [];
    for (const childId of validChildIds(collection)) {
      if (seen.has(childId)) {
        issues.push({
          code: "duplicate-child",
          entry: collection,
          message: `child id "${childId}" is listed more than once`,
        });
        continue;
      }
      seen.add(childId);
      const child = byId.get(childId);
      if (!child) {
        issues.push({
          code: "missing-child",
          entry: collection,
          message: `unknown child id: ${childId}`,
        });
        continue;
      }
      children.push(child);
      if (child.kind === "collection") collectionChildren.push(childId);
      const currentParent = parentById.get(childId);
      if (currentParent && currentParent.id !== collection.id) {
        issues.push({
          code: "multiple-parents",
          entry: collection,
          message: `child ${childId} is already claimed by collection ${currentParent.id}`,
        });
      } else if (!currentParent) {
        parentById.set(childId, collection);
      }
    }
    childrenById.set(collection.id, children);
    collectionEdges.set(collection.id, collectionChildren.sort());
  }

  issues.push(...cycleIssues(collections, collectionEdges, byId));
  const ancestorsById = new Map<string, readonly T[]>();
  for (const entry of byId.values()) {
    ancestorsById.set(entry.id, ancestors(entry, parentById));
  }
  const roots = [...byId.values()]
    .filter((entry) => !parentById.has(entry.id))
    .sort(compareEntries);

  return {
    hierarchy: { ancestorsById, byId, childrenById, parentById, roots },
    issues,
  };
}

function ancestors<T extends HierarchyEntry>(
  entry: T,
  parentById: ReadonlyMap<string, T>,
): readonly T[] {
  const result: T[] = [];
  const visited = new Set([entry.id]);
  let parent = parentById.get(entry.id);
  while (parent) {
    if (visited.has(parent.id)) return [];
    visited.add(parent.id);
    result.push(parent);
    parent = parentById.get(parent.id);
  }
  return result.reverse();
}

function cycleIssues<T extends HierarchyEntry>(
  collections: readonly T[],
  edges: ReadonlyMap<string, readonly string[]>,
  byId: ReadonlyMap<string, T>,
): readonly HierarchyIssue<T>[] {
  const finished = new Set<string>();
  const issues: HierarchyIssue<T>[] = [];
  const reported = new Set<string>();
  for (const collection of collections) {
    if (finished.has(collection.id)) continue;
    const stack: Array<{ id: string; nextChild: number }> = [
      { id: collection.id, nextChild: 0 },
    ];
    const activeIndex = new Map<string, number>();
    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (!frame) break;
      if (!activeIndex.has(frame.id)) {
        activeIndex.set(frame.id, stack.length - 1);
      }
      const children = edges.get(frame.id) ?? [];
      const childId = children[frame.nextChild];
      if (childId === undefined) {
        finished.add(frame.id);
        activeIndex.delete(frame.id);
        stack.pop();
        continue;
      }
      frame.nextChild += 1;
      const cycleStart = activeIndex.get(childId);
      if (cycleStart !== undefined) {
        const cycle = normalizeCycle([
          ...stack.slice(cycleStart).map(({ id }) => id),
          childId,
        ]);
        const signature = cycle.join(" -> ");
        const owner = byId.get(frame.id);
        if (owner && !reported.has(signature)) {
          reported.add(signature);
          issues.push({
            code: "collection-cycle",
            entry: owner,
            message: `collection cycle: ${signature}`,
          });
        }
      } else if (!finished.has(childId)) {
        stack.push({ id: childId, nextChild: 0 });
      }
    }
  }
  return issues;
}

function normalizeCycle(cycle: readonly string[]): readonly string[] {
  const nodes = cycle.slice(0, -1);
  let first = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    if ((nodes[index] ?? "").localeCompare(nodes[first] ?? "") < 0) {
      first = index;
    }
  }
  const rotated = [...nodes.slice(first), ...nodes.slice(0, first)];
  return [...rotated, rotated[0] ?? ""];
}

function validChildIds(entry: HierarchyEntry): readonly string[] {
  return Array.isArray(entry.childIds) &&
    entry.childIds.every((value) => typeof value === "string")
    ? entry.childIds
    : [];
}

function isCollection<T extends HierarchyEntry>(entry: T): boolean {
  return entry.kind === "collection";
}

function compareEntries(left: HierarchyEntry, right: HierarchyEntry): number {
  return left.id.localeCompare(right.id);
}
