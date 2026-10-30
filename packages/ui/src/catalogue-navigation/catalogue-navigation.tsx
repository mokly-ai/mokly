/**
 * The catalogue navigation column: its head with Collapse all, the All and
 * Changes filter, the status line and the catalogue tree in one scrolling
 * pane, and the separator that resizes the column. The host builds the tree
 * as plain records and receives each choice through a callback.
 */

import type { CSSProperties, Ref } from "react";

import {
  CatalogueTree,
  type NavigationSection,
} from "../catalogue-tree/catalogue-tree.js";

import { FilterGroup, StatusLine } from "./navigation-filter.js";
import type {
  NavigationFilter,
  NavigationStatus,
} from "./navigation-records.js";
import { ResizeHandle } from "./navigation-resize.js";

export type {
  NavigationChangesStatus,
  NavigationFilter,
  NavigationStatus,
  NavigationStatusMessage,
} from "./navigation-records.js";

export function CatalogueNavigation({
  busy,
  filter,
  id,
  interactive,
  maximumWidth,
  onCollapseAll,
  onDisclosure,
  onResizing,
  onScroll,
  onView,
  onWidth,
  onWidthCommit,
  ref,
  resizable,
  scrollRef,
  sections,
  status,
  width,
}: {
  /** Whether the tree waits for change detection, which `aria-busy` reports. */
  busy: boolean;
  /** The All and Changes filter; absent where the catalogue has no Changes. */
  filter?: NavigationFilter | undefined;
  /** The id of the column, unique in the document. */
  id: string;
  /**
   * Whether section and folder summaries report their choices through
   * `onDisclosure` instead of their native toggle.
   */
  interactive: boolean;
  /** The widest column, in pixels. */
  maximumWidth: number;
  onCollapseAll?: (() => void) | undefined;
  /**
   * Receives a disclosure key and the open state that the reader chose for a
   * section, a folder, or an entry's list.
   */
  onDisclosure?: ((disclosure: string, open: boolean) => void) | undefined;
  /** Receives `true` when a drag of the separator starts and `false` when it ends. */
  onResizing?: ((resizing: boolean) => void) | undefined;
  /** Receives the scroll offset of the tree after each scroll. */
  onScroll?: ((top: number) => void) | undefined;
  /** Receives the filter that the reader chose. */
  onView?: ((view: "all" | "changes") => void) | undefined;
  /**
   * Receives each width that the separator asks for, before the host bounds
   * it. Without it the separator is inert.
   */
  onWidth?: ((width: number) => void) | undefined;
  /** Receives the width to keep once a resize ends. */
  onWidthCommit?: ((width: number) => void) | undefined;
  /** The column element, for a host that acts around it. */
  ref?: Ref<HTMLElement> | undefined;
  /**
   * Whether the reader can resize the column: the separator shows, and
   * `width` sets the column's width.
   */
  resizable: boolean;
  /** The scrolling tree element, for a host that restores and reveals rows. */
  scrollRef?: Ref<HTMLDivElement> | undefined;
  sections: readonly NavigationSection[];
  /** The status line at the top of the tree; absent without Changes. */
  status?: NavigationStatus | undefined;
  /** The column width, in pixels. */
  width: number;
}) {
  const style: (CSSProperties & { "--mbk-nav-width": string }) | undefined =
    resizable ? { "--mbk-nav-width": `${width}px` } : undefined;
  return (
    <nav
      aria-label="Catalogue"
      className="mbk-nav mbk-reset"
      data-mokly-nav=""
      data-resize-ready={resizable ? "" : undefined}
      id={id}
      ref={ref}
      style={style}
    >
      <div className="mbk-nav-head mbk-reset">
        Catalogue
        <button
          className="mbk-nav-collapse mbk-reset"
          data-mokly-collapse=""
          onClick={() => onCollapseAll?.()}
          type="button"
        >
          Collapse all
        </button>
      </div>
      {filter ? <FilterGroup filter={filter} onView={onView} /> : null}
      <div
        aria-busy={busy}
        className="mbk-nav-scroll mbk-reset"
        data-mokly-nav-scroll=""
        onScroll={(event) => onScroll?.(event.currentTarget.scrollTop)}
        ref={scrollRef}
      >
        {status ? <StatusLine status={status} /> : null}
        <CatalogueTree
          interactive={interactive}
          onDisclosure={onDisclosure}
          sections={sections}
        />
      </div>
      <ResizeHandle
        actions={{ onResizing, onWidth, onWidthCommit }}
        maximum={maximumWidth}
        width={width}
      />
    </nav>
  );
}
