/**
 * The catalogue tree: sections and folders as native `<details>`, and entry
 * rows with the list that their toggle discloses. The host builds the tree
 * as plain records and receives each disclosure choice through a callback.
 */

import { ChevronIcon, FolderIcon, FolderOpenIcon } from "../icons/icons.js";

import {
  disclosureHandlers,
  filterMark,
  type DisclosureActions,
} from "./tree-disclosure.js";
import { RowLink, rowStyle } from "./tree-link.js";
import type {
  NavigationFolder,
  NavigationLeaf,
  NavigationRow,
  NavigationSection,
} from "./tree-records.js";

export type {
  NavigationDisclosure,
  NavigationEntryKind,
  NavigationFolder,
  NavigationLeaf,
  NavigationLink,
  NavigationList,
  NavigationRow,
  NavigationSection,
} from "./tree-records.js";

/** An authored folder row and the rows that it holds. */
function Folder({
  actions,
  folder,
}: {
  actions: DisclosureActions;
  folder: NavigationFolder;
}) {
  const handlers = disclosureHandlers(actions, folder);
  return (
    <details
      className="mbk-nav-group mbk-reset"
      data-filter-open={filterMark(folder.filterOpen)}
      data-nav-folder={folder.key}
      data-nav-disclosure={folder.disclosure}
      hidden={folder.hidden}
      onToggle={handlers.onToggle}
      open={folder.open}
    >
      <summary
        className="mbk-nav-row mbk-reset"
        onClick={handlers.onSummaryClick}
        style={rowStyle(folder.depth)}
      >
        <span className="mbk-nav-ico folder mbk-reset">
          <FolderIcon />
          <FolderOpenIcon />
        </span>
        <span className="mbk-nav-label mbk-reset">{folder.label}</span>
        {folder.count > 0 ? (
          <span className="mbk-nav-count mbk-reset">{folder.count}</span>
        ) : null}
      </summary>
      <Rows actions={actions} rows={folder.rows} />
    </details>
  );
}

/**
 * An entry row. An entry with a list pairs its link with a chevron button,
 * because a row cannot be both a link and a `<summary>`, and the list follows
 * the row: the variants, then the other members. The list is a `div` closed by
 * `hidden`, and the button's `aria-expanded` follows it.
 */
function Leaf({
  actions,
  leaf,
}: {
  actions: DisclosureActions;
  leaf: NavigationLeaf;
}) {
  const list = leaf.list;
  if (list === undefined) return <RowLink link={leaf.link} variant={false} />;
  const noun = list.rows.length > 0 ? "contents" : "variants";
  return (
    <>
      <div className="mbk-nav-leaf mbk-reset" hidden={list.hidden}>
        <RowLink link={leaf.link} variant={false} />
        <button
          aria-controls={list.id}
          aria-expanded={list.open ? "true" : "false"}
          aria-label={`${list.open ? "Hide" : "Show"} ${noun} of ${list.title}`}
          className="mbk-nav-variants-toggle mbk-reset"
          data-nav-variants-label={list.title}
          data-nav-variants-noun={noun}
          data-nav-variants-toggle={list.id}
          onClick={() => actions.onDisclosure?.(list.disclosure, !list.open)}
          type="button"
        >
          <ChevronIcon size={16} />
        </button>
      </div>
      <div
        className="mbk-nav-variants mbk-reset"
        data-filter-open={filterMark(list.filterOpen)}
        data-nav-disclosure={list.disclosure}
        data-nav-variants=""
        hidden={list.open && !list.hidden ? undefined : true}
        id={list.id}
      >
        {list.variants.map((variant) => (
          <RowLink key={variant.key} link={variant} variant />
        ))}
        <Rows actions={actions} rows={list.rows} />
      </div>
    </>
  );
}

/** Every row at one level of a section, a folder, or a list. */
function Rows({
  actions,
  rows,
}: {
  actions: DisclosureActions;
  rows: readonly NavigationRow[];
}) {
  return (
    <>
      {rows.map((row) =>
        row.kind === "folder" ? (
          <Folder actions={actions} folder={row} key={row.key} />
        ) : (
          <Leaf actions={actions} key={row.link.key} leaf={row} />
        ),
      )}
    </>
  );
}

/** A top-level section and its rows. */
function Section({
  actions,
  section,
}: {
  actions: DisclosureActions;
  section: NavigationSection;
}) {
  const handlers = disclosureHandlers(actions, section);
  return (
    <details
      className="mbk-nav-section mbk-reset"
      data-filter-open={filterMark(section.filterOpen)}
      data-nav-disclosure={section.disclosure}
      data-nav-section={section.id}
      hidden={section.hidden}
      onToggle={handlers.onToggle}
      open={section.open}
    >
      <summary
        className="mbk-nav-section-head mbk-reset"
        onClick={handlers.onSummaryClick}
      >
        <span aria-hidden="true" className="mbk-nav-section-chevron mbk-reset">
          <ChevronIcon />
        </span>
        {section.label}
      </summary>
      <Rows actions={actions} rows={section.rows} />
    </details>
  );
}

/**
 * Every section of the tree. Section and folder summaries report a choice
 * through `onDisclosure` only while the tree is interactive; otherwise each
 * `<details>` keeps its native toggle. An entry's toggle always reports.
 */
export function CatalogueTree({
  interactive,
  onDisclosure,
  sections,
}: {
  interactive: boolean;
  /**
   * Receives a disclosure key and the open state that the reader chose for a
   * section, a folder, or an entry's list.
   */
  onDisclosure?: ((disclosure: string, open: boolean) => void) | undefined;
  sections: readonly NavigationSection[];
}) {
  const actions = { interactive, onDisclosure };
  return (
    <>
      {sections.map((section) => (
        <Section actions={actions} key={section.disclosure} section={section} />
      ))}
    </>
  );
}
