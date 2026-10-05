import { VARIANT_INDEX } from "../authoring/markers.js";

interface EntryOrderFields {
  path: string;
  kind: string;
  variantOf?: unknown;
  [VARIANT_INDEX]?: number;
}

/**
 * Order ordinary entries by kind then path while keeping each valid screen or
 * component parent's variants immediately after it in input order. A variant without one
 * uniquely valid non-variant parent stays in ordinary kind/path position so the
 * relationship validator can report it deterministically.
 */
export function orderEntriesWithVariants<T>(
  values: readonly T[],
  entryOf: (value: T) => EntryOrderFields,
): T[] {
  const byPath = new Map<string, T[]>();
  for (const value of values) {
    const entry = entryOf(value);
    byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), value]);
  }

  const grouped = new Set<T>();
  const variantsByParent = new Map<T, T[]>();
  for (const value of values) {
    const entry = entryOf(value);
    if (
      !["screen", "component"].includes(entry.kind) ||
      typeof entry.variantOf !== "string"
    ) {
      continue;
    }
    const candidates = byPath.get(entry.variantOf) ?? [];
    const parent = candidates.length === 1 ? candidates[0] : undefined;
    if (parent === undefined || parent === value) continue;
    const parentEntry = entryOf(parent);
    if (
      parentEntry.kind !== entry.kind ||
      Object.hasOwn(parentEntry, "variantOf")
    )
      continue;
    grouped.add(value);
    variantsByParent.set(parent, [
      ...(variantsByParent.get(parent) ?? []),
      value,
    ]);
  }

  for (const variants of variantsByParent.values())
    variants.sort(
      (left, right) =>
        (entryOf(left)[VARIANT_INDEX] ?? 0) -
        (entryOf(right)[VARIANT_INDEX] ?? 0),
    );

  return values
    .filter((value) => !grouped.has(value))
    .sort((left, right) => compareEntries(entryOf(left), entryOf(right)))
    .flatMap((value) => [value, ...(variantsByParent.get(value) ?? [])]);
}

function compareEntries(left: EntryOrderFields, right: EntryOrderFields) {
  return lexical(left.kind, right.kind) || lexical(left.path, right.path);
}

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
