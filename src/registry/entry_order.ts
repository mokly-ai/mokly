interface EntryOrderFields {
  id: string;
  kind: string;
  route?: string;
  variantOf?: unknown;
}

/**
 * Order ordinary entries by route then id while keeping each valid screen
 * parent's variants immediately after it in input order. A variant without one
 * uniquely valid root-screen parent stays in ordinary route/id position so the
 * relationship validator can report it deterministically.
 */
export function orderEntriesWithVariants<T>(
  values: readonly T[],
  entryOf: (value: T) => EntryOrderFields,
): T[] {
  const byId = new Map<string, T[]>();
  for (const value of values) {
    const entry = entryOf(value);
    byId.set(entry.id, [...(byId.get(entry.id) ?? []), value]);
  }

  const grouped = new Set<T>();
  const variantsByParent = new Map<T, T[]>();
  for (const value of values) {
    const entry = entryOf(value);
    if (entry.kind !== "screen" || typeof entry.variantOf !== "string") {
      continue;
    }
    const candidates = byId.get(entry.variantOf) ?? [];
    const parent = candidates.length === 1 ? candidates[0] : undefined;
    if (parent === undefined || parent === value) continue;
    const parentEntry = entryOf(parent);
    if (
      parentEntry.kind !== "screen" ||
      Object.hasOwn(parentEntry, "variantOf")
    )
      continue;
    grouped.add(value);
    variantsByParent.set(parent, [
      ...(variantsByParent.get(parent) ?? []),
      value,
    ]);
  }

  return values
    .filter((value) => !grouped.has(value))
    .sort((left, right) => compareEntries(entryOf(left), entryOf(right)))
    .flatMap((value) => [value, ...(variantsByParent.get(value) ?? [])]);
}

function compareEntries(left: EntryOrderFields, right: EntryOrderFields) {
  const leftRoute = left.route ?? "";
  const rightRoute = right.route ?? "";
  return lexical(leftRoute, rightRoute) || lexical(left.id, right.id);
}

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
