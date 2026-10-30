/**
 * The plain records that the catalogue tree draws: sections, folders, entry
 * rows, and the lists that entries disclose. The host builds them from its
 * catalogue and its state; the tree reads nothing else.
 */

/** The kind of catalogue entry that a row links to; each has its own glyph. */
export type NavigationEntryKind =
  "component" | "document" | "page" | "screen" | "use-case";

/** One row link: an entry, or a variant in an entry's list. */
export interface NavigationLink {
  /** Unique among the link's siblings. */
  key: string;
  /** The entry's path, which `data-entry-id` carries. */
  entry: string;
  kind: NavigationEntryKind;
  href: string;
  /** The route of the entry, which `data-route` carries. */
  route: string;
  /** The text of the row, such as the entry's title. */
  label: string;
  /** The nesting depth, which sets the indent and the guide lines. */
  depth: number;
  /** Whether the row is the current page. */
  current: boolean;
  hidden: boolean;
  /** Whether the entry changed, which draws the changed mark. */
  changed: boolean;
  /** Whether a variant of the entry changed, which also draws the mark. */
  changedVariants: boolean;
  /** Whether the entry is its folder's own page. */
  index: boolean;
  /** Whether the entry was removed; a removed entry's changed mark is hidden. */
  removed: boolean;
  /** Whether the entry is a removed page or document. */
  removedPage: boolean;
  /** Whether the entry is a removed variant. */
  removedVariant: boolean;
  /** The entry's declared tags, which `data-tags` carries. */
  tags: readonly string[];
}

/**
 * The open state of a section, a folder, or an entry's list, and the key
 * that `onDisclosure` reports for it.
 */
export interface NavigationDisclosure {
  /** The disclosure key, which `data-nav-disclosure` carries. */
  disclosure: string;
  open: boolean;
  /**
   * The open state from before search or Changes began to filter the tree,
   * which `data-filter-open` carries. Absent while no filter applies.
   */
  filterOpen?: boolean | undefined;
}

/** A top-level section, such as Specs or Components. */
export interface NavigationSection extends NavigationDisclosure {
  /** The section id, which `data-nav-section` carries. */
  id: string;
  label: string;
  hidden: boolean;
  rows: readonly NavigationRow[];
}

/** An authored folder: a disclosure row with no destination of its own. */
export interface NavigationFolder extends NavigationDisclosure {
  kind: "folder";
  /** The folder's key, unique among its siblings, which `data-nav-folder` carries. */
  key: string;
  label: string;
  depth: number;
  hidden: boolean;
  /** The child rows that the filters keep. A count of zero is not shown. */
  count: number;
  rows: readonly NavigationRow[];
}

/**
 * The list that an entry's toggle discloses: the entry's variants, then the
 * other members of the folder whose own page the entry is.
 */
export interface NavigationList extends NavigationDisclosure {
  /** The id of the list, unique in the document. */
  id: string;
  /** The entry's title, which names the toggle. */
  title: string;
  /** Whether the filters hide the entry's row, which also hides the list. */
  hidden: boolean;
  variants: readonly NavigationLink[];
  rows: readonly NavigationRow[];
}

/** An entry row, with the list that it discloses when it has one. */
export interface NavigationLeaf {
  kind: "leaf";
  link: NavigationLink;
  list?: NavigationList | undefined;
}

/** One row of a section, a folder, or a list. */
export type NavigationRow = NavigationFolder | NavigationLeaf;
