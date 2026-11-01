import { mockLink } from "@mokly/mokly";

import type {
  NavigationEntryKind,
  NavigationLink,
  NavigationRow as TreeRow,
  NavigationSection,
} from "../../../../../../packages/ui/src/catalogue-tree/catalogue-tree.js";

import type { CatalogueNavigationProps } from "./catalogue-navigation.js";

export type NavigationRow = CatalogueNavigationProps["rows"][number];
type NavigationSectionId = "components" | "specs";

interface NavigationBranch {
  children: NavigationBranch[];
  row: NavigationRow;
}

/** What the records need from the view: an id prefix and the current rows. */
export interface NavigationRecordContext {
  /** A prefix that makes each list id unique in the document. */
  id: string;
  /** Whether an entry row is the current page. */
  current: (row: NavigationRow) => boolean;
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
 * One branch in one section. An entry keeps its list whether the list is
 * open or closed, as the shell does, so a closed list holds its rows hidden.
 */
function projectBranch(
  branch: NavigationBranch,
  section: NavigationSectionId,
): NavigationBranch | undefined {
  if (branch.row.kind !== "folder") {
    const component = branch.row.kind === "component";
    if (component !== (section === "components")) return undefined;
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
  const emptySpecsFolder = section === "specs" && branch.children.length === 0;
  if (children.length === 0 && !emptySpecsFolder) return undefined;
  return { children, row: branch.row };
}

/**
 * The entry kind that the shell names in `data-entry-kind` and draws a glyph
 * for: a flow is a use case, and a variant takes its parent's kind. A folder
 * never becomes a row link, so its kind is only a type's fallback.
 */
function entryKind(row: NavigationRow): NavigationEntryKind {
  if (row.kind === "flow") return "use-case";
  if (row.kind === "variant") return row.variantParentKind ?? "screen";
  if (row.kind === "folder") return "screen";
  return row.kind;
}

/**
 * One row link. A row without a destination is a picture of the row. A moved
 * entry's label ends in `· Moved` and, like a Removed row, takes no changed
 * mark, while its list keeps the entry's own title.
 */
function rowLink(
  row: NavigationRow,
  context: NavigationRecordContext,
): NavigationLink {
  return {
    changed: row.changed === true && row.moved !== true,
    changedVariants: false,
    current: context.current(row),
    depth: row.depth,
    entry: row.key,
    hidden: false,
    href: row.to === undefined ? undefined : mockLink(row.to),
    index: row.contents === true,
    key: row.key,
    kind: entryKind(row),
    label: row.moved ? `${row.label} · Moved` : row.label,
    removed: false,
    removedPage: false,
    removedVariant: false,
    route: row.key,
    tags: [],
  };
}

function treeRow(
  branch: NavigationBranch,
  section: NavigationSectionId,
  context: NavigationRecordContext,
): TreeRow {
  const { row } = branch;
  if (row.kind === "folder")
    return {
      count: branch.children.length,
      depth: row.depth,
      disclosure: `${section}:${row.key}`,
      hidden: false,
      key: row.key,
      kind: "folder",
      label: row.label,
      open: row.open === true,
      rows: branch.children.map((child) => treeRow(child, section, context)),
    };
  const link = rowLink(row, context);
  if (row.variants === undefined) return { kind: "leaf", link };
  const variants = branch.children.filter(
    (child) => child.row.kind === "variant",
  );
  const members = branch.children.filter(
    (child) => child.row.kind !== "variant",
  );
  return {
    kind: "leaf",
    link,
    list: {
      disclosure: `${section}:${row.key}:list`,
      hidden: false,
      id: `${context.id}${section}-${row.key}`,
      open: row.variants === "open",
      rows: members.map((member) => treeRow(member, section, context)),
      title: row.label,
      variants: variants.map((variant) => rowLink(variant.row, context)),
    },
  };
}

/**
 * Split the one depicted tree by kind into the shell's section records:
 * Components holds component entries and the folders that contain them, and
 * Specs holds every other kind. A folder holding both kinds appears in each
 * section with only that section's children, so both sections stay views of
 * the same folders.
 */
export function navigationSections(
  rows: readonly NavigationRow[],
  context: NavigationRecordContext,
): NavigationSection[] {
  const forest = navigationForest(rows);
  return (["specs", "components"] as const).flatMap((id) => {
    const projected = forest.flatMap((branch) => {
      const section = projectBranch(branch, id);
      return section ? [section] : [];
    });
    return projected.length > 0
      ? [
          {
            disclosure: id,
            hidden: false,
            id,
            label: id === "specs" ? "Specs" : "Components",
            open: true,
            rows: projected.map((branch) => treeRow(branch, id, context)),
          },
        ]
      : [];
  });
}
