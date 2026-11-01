/** Records and props for the catalogue navigation tests. */

import type { ComponentProps } from "react";

import type { CatalogueNavigation } from "../src/catalogue-navigation/catalogue-navigation.js";
import type {
  CatalogueTree,
  NavigationFolder,
  NavigationLeaf,
  NavigationLink,
  NavigationList,
  NavigationSection,
} from "../src/catalogue-tree/catalogue-tree.js";

/** A plain current screen row at the top level, with the given changes. */
export function link(
  entry: string,
  fields: Partial<NavigationLink> = {},
): NavigationLink {
  return {
    changed: false,
    changedVariants: false,
    current: false,
    depth: 0,
    entry,
    hidden: false,
    href: `/view/${entry}/`,
    index: false,
    key: `entry:${entry}`,
    kind: "screen",
    label: entry,
    removed: false,
    removedPage: false,
    removedVariant: false,
    route: `/${entry}`,
    tags: [],
    ...fields,
  };
}

/** A leaf row, with a list when one is given. */
export function leaf(
  row: NavigationLink,
  list?: Partial<NavigationList>,
): NavigationLeaf {
  if (list === undefined) return { kind: "leaf", link: row };
  return {
    kind: "leaf",
    link: row,
    list: {
      disclosure: `variants:${row.entry}`,
      hidden: false,
      id: `root-mb-nav-variants-specs-${row.entry}`,
      open: false,
      rows: [],
      title: row.label,
      variants: [],
      ...list,
    },
  };
}

/** A closed folder at the top level with no rows. */
export function folder(
  key: string,
  fields: Partial<NavigationFolder> = {},
): NavigationFolder {
  return {
    count: 0,
    depth: 0,
    disclosure: `folder:specs:${key}`,
    hidden: false,
    key: `folder:${key}`,
    kind: "folder",
    label: key,
    open: false,
    rows: [],
    ...fields,
  };
}

/** The open Specs section with the given rows. */
export function specs(
  rows: NavigationSection["rows"],
  fields: Partial<NavigationSection> = {},
): NavigationSection {
  return {
    disclosure: "section:specs",
    hidden: false,
    id: "specs",
    label: "Specs",
    open: true,
    rows,
    ...fields,
  };
}

/** The props of an interactive, resizable column with no rows. */
export function column(
  fields: Partial<ComponentProps<typeof CatalogueNavigation>> = {},
): ComponentProps<typeof CatalogueNavigation> {
  return {
    busy: false,
    id: "root-mb-nav",
    interactive: true,
    maximumWidth: 480,
    resizable: true,
    sections: [],
    width: 248,
    ...fields,
  };
}

/** The props of an interactive tree with no sections. */
export function tree(
  fields: Partial<ComponentProps<typeof CatalogueTree>> = {},
): ComponentProps<typeof CatalogueTree> {
  return { interactive: true, sections: [], ...fields };
}
