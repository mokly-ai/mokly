import type { CatalogueNavigationProps } from "./catalogue-navigation.js";

/** One written row. It has no count: a folder's count derives from its rows. */
export type NavigationRow = CatalogueNavigationProps["rows"][number];

/** One drawn row; a folder row carries the count of its rows in the section. */
export type DrawnNavigationRow = NavigationRow & { readonly count?: number };

type NavigationSectionId = "components" | "specs";

interface NavigationBranch {
  children: NavigationBranch[];
  row: NavigationRow;
}

interface DrawnBranch {
  children: DrawnBranch[];
  row: DrawnNavigationRow;
}

/**
 * Build the depicted tree. Folders nest by depth; a variant row belongs to
 * the leaf it follows rather than to that leaf's folder, so a parent keeps
 * its variants and a folder never counts them as children. A folder's own
 * screen with `contents` also holds the deeper rows after its variants: the
 * folder's other members, which its list discloses after the variants.
 */
function navigationForest(rows: readonly NavigationRow[]): NavigationBranch[] {
  const roots: NavigationBranch[] = [];
  const parents: Array<{ branch: NavigationBranch; depth: number }> = [];
  let leaf: NavigationBranch | undefined;
  for (const row of rows) {
    const branch = { children: [], row };
    if (row.kind === "variant" && leaf) {
      leaf.children.push(branch);
      continue;
    }
    while ((parents.at(-1)?.depth ?? -1) >= row.depth) parents.pop();
    const parent = parents.at(-1)?.branch;
    (parent?.children ?? roots).push(branch);
    if (row.kind === "folder" || row.contents)
      parents.push({ branch, depth: row.depth });
    leaf = row.kind === "folder" ? undefined : branch;
  }
  return roots;
}

/**
 * Keep the branch's rows that belong to `section`. A folder counts its
 * immediate child rows in the section, as the shell does, and keeps that
 * count while it is closed; a folder without such rows is not drawn there.
 */
function projectBranch(
  branch: NavigationBranch,
  section: NavigationSectionId,
): DrawnBranch | undefined {
  if (branch.row.kind !== "folder") {
    const component = branch.row.kind === "component";
    if (component !== (section === "components")) return undefined;
    if (branch.row.variants !== "open")
      return { children: [], row: branch.row };
    return {
      row: branch.row,
      children: branch.children.flatMap((child) => {
        if (child.row.kind === "variant") return [child];
        const projected = projectBranch(child, section);
        return projected ? [projected] : [];
      }),
    };
  }
  const children = branch.children.flatMap((child) => {
    const projected = projectBranch(child, section);
    return projected ? [projected] : [];
  });
  if (children.length === 0) return undefined;
  return { children, row: { ...branch.row, count: children.length } };
}

/** The rows a reader sees: a closed folder hides the rows it counts. */
function flattenBranches(
  branches: readonly DrawnBranch[],
): DrawnNavigationRow[] {
  return branches.flatMap((branch) => [
    branch.row,
    ...(branch.row.kind === "folder" && !branch.row.open
      ? []
      : flattenBranches(branch.children)),
  ]);
}

/**
 * Split the one depicted tree by kind: Components holds component entries and
 * the folders that contain them, and Specs holds every other kind. A folder
 * holding both kinds appears in each section with only that section's
 * children, so both sections stay views of the same folders.
 */
export function navigationSections(rows: readonly NavigationRow[]) {
  const forest = navigationForest(rows);
  return (["specs", "components"] as const).flatMap((id) => {
    const projected = forest.flatMap((branch) => {
      const section = projectBranch(branch, id);
      return section ? [section] : [];
    });
    const sectionRows = flattenBranches(projected);
    return sectionRows.length > 0
      ? [
          {
            id,
            label: id === "specs" ? "Specs" : "Components",
            rows: sectionRows,
          },
        ]
      : [];
  });
}
