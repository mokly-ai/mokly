/**
 * The documentation's mobile sub-bar and the tree sheet that it opens. Below
 * the breakpoint the panels leave the canvas: a sticky sub-bar under the
 * tool bar names the section and the page, opens the section tree as a
 * sheet and opens search. The open state draws the sheet in place over a
 * scrim, as the open menu does, because a static document has no top layer.
 */

import type { DocsPage } from "./docs-pages.js";
import {
  DocsSearch,
  DocsTreeFoot,
  DocsTreeSections,
  DocsVersion,
} from "./docs_navigation.js";
import { SiteIcon } from "./icons.js";

/** The id that ties the sub-bar's Layers control to the sheet it opens. */
const SHEET_ID = "docs-layers";

/**
 * The sub-bar: the Layers control, named by the section and the page, and
 * the compact search control. `open` marks the Layers control expanded.
 */
export function DocsSubbar({ open, page }: { open: boolean; page: DocsPage }) {
  return (
    <div className="site-docs-subbar">
      <button
        aria-controls={SHEET_ID}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="site-docs-layers-toggle"
        type="button"
      >
        <SiteIcon name="layers" size={16} />
        <span className="site-docs-layers-toggle-trail">
          <span className="site-docs-layers-toggle-section">
            {page.section}
          </span>{" "}
          <span aria-hidden="true" className="site-docs-layers-toggle-sep">
            /
          </span>{" "}
          <span className="site-docs-layers-toggle-page">{page.title}</span>
        </span>
        <SiteIcon
          className="site-docs-layers-toggle-chevron"
          name="chevronDown"
          size={16}
        />
      </button>
      <DocsSearch compact />
    </div>
  );
}

/**
 * The open tree sheet under the sub-bar: the CLI version, every section
 * with the page you are reading selected, and the Changelog link, over a
 * scrim that dims the page.
 */
export function DocsLayersSheet({ page }: { page: DocsPage }) {
  return (
    <>
      <div aria-hidden="true" className="site-docs-sheet-scrim" />
      <dialog
        aria-label="Layers"
        className="site-docs-sheet"
        id={SHEET_ID}
        open
      >
        <nav aria-label="Documentation" className="site-doc-tree">
          <div className="site-docs-layers-top">
            <DocsVersion />
          </div>
          <DocsTreeSections page={page} />
          <DocsTreeFoot />
        </nav>
      </dialog>
    </>
  );
}
