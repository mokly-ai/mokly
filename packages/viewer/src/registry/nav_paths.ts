/** One sortable folder or entry, independent of its rendering shape. */
export interface NavigationSortItem {
  kind: "folder" | "entry";
  key: string;
  label: string;
}
/** Total default sibling order: folders, then leaves, by title and path. */
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
