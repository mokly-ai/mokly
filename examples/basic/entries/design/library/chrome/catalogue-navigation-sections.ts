import type { CatalogueNavigationProps } from "./catalogue-navigation.js";

export type NavigationRow = CatalogueNavigationProps["rows"][number];
type NavigationSectionId = "components" | "pages";

interface NavigationBranch {
  children: NavigationBranch[];
  row: NavigationRow;
}

/**
 * Build the depicted tree. Folders nest by depth; a variant row belongs to
 * the leaf it follows rather than to that leaf's folder, so a parent keeps
 * its variants and a folder never counts them as children.
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
    if (row.kind === "folder") {
      parents.push({ branch, depth: row.depth });
      leaf = undefined;
    } else {
      leaf = branch;
    }
  }
  return roots;
}

function projectBranch(
  branch: NavigationBranch,
  section: NavigationSectionId,
): NavigationBranch | undefined {
  if (branch.row.kind !== "folder") {
    const component = branch.row.kind === "component";
    if (component !== (section === "components")) return undefined;
    return branch.row.variants === "open"
      ? branch
      : { children: [], row: branch.row };
  }
  const children = branch.children.flatMap((child) => {
    const projected = projectBranch(child, section);
    return projected ? [projected] : [];
  });
  const emptyPageFolder = section === "pages" && branch.children.length === 0;
  if (children.length === 0 && !emptyPageFolder) return undefined;
  const { count: _count, ...row } = branch.row;
  return {
    children,
    row: children.length > 0 ? { ...row, count: children.length } : row,
  };
}

function flattenBranches(
  branches: readonly NavigationBranch[],
): NavigationRow[] {
  return branches.flatMap((branch) => [
    branch.row,
    ...flattenBranches(branch.children),
  ]);
}

export function navigationSections(rows: readonly NavigationRow[]) {
  const forest = navigationForest(rows);
  return (["pages", "components"] as const).flatMap((id) => {
    const projected = forest.flatMap((branch) => {
      const section = projectBranch(branch, id);
      return section ? [section] : [];
    });
    const sectionRows = flattenBranches(projected);
    return sectionRows.length > 0
      ? [
          {
            id,
            label: id === "pages" ? "Pages" : "Components",
            rows: sectionRows,
          },
        ]
      : [];
  });
}
