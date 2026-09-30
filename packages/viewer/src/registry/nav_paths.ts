/** The only legal comparison key for navigation labels within one parent. */
export function navConflictKey(label: string): string {
  return label
    .normalize("NFKC")
    .replace(/\s/gu, "")
    .toUpperCase()
    .toLowerCase();
}

/** Whether a label may be used as a navigation folder segment. */
export function validNavLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/^\s|\s$/u.test(value) &&
    !value.includes("/")
  );
}

/** Stable, separator-safe key of one path of validated labels. */
export function navPathKey(path: readonly string[]): string {
  return path.join("/");
}

/** One sortable folder or routed entry, independent of its rendering shape. */
export interface NavigationSortItem {
  kind: "folder" | "entry";
  key: string;
  label: string;
}

/** Shared total sibling order for the hierarchy, shell and public tree. */
export function compareNavigationNodes(
  left: NavigationSortItem,
  right: NavigationSortItem,
): number {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  return (
    left.label.localeCompare(right.label, "en") ||
    (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  );
}
