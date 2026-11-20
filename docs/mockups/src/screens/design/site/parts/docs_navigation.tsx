/**
 * The documentation's Layers panel: the section tree, drawn as the layers of
 * the design file. The search control and the published CLI version head
 * it, every section is listed expanded under a mono rubric with its page
 * count, each page is a 44px layer row with a file icon, the page you are
 * reading is the selected layer, and the Changelog link holds the foot.
 */

import { MockLink } from "@mokly/mokly";

import { docsPageScreen, type DocsPage } from "./docs-pages.js";
import { DOCS_SECTIONS } from "./docs_data.js";
import { SiteIcon } from "./icons.js";
import { SiteChip } from "./labels.js";
import { SITE_SCREENS } from "./links.js";
import { SitePanel, SitePanelRow } from "./panel.js";
import { PACKAGE_VERSION } from "./version.js";

/**
 * The documentation search control, which opens the search dialog, as
 * `⌘K`, `Ctrl K` and `/` do. The full control names itself and shows its
 * keys; the compact one is the mobile sub-bar's 44px icon control.
 */
export function DocsSearch({
  compact = false,
}: {
  compact?: boolean | undefined;
}) {
  return (
    <button
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      className="site-search"
      type="button"
    >
      <SiteIcon name="search" size={compact ? 18 : 15} />
      {compact ? (
        <span className="site-visually-hidden">Search docs</span>
      ) : (
        <>
          <span className="site-search-label">Search docs</span>
          <kbd aria-hidden="true" className="site-search-key">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  );
}

/** The published CLI version, which links the changelog. */
export function DocsVersion() {
  return (
    <MockLink className="site-version-link" to={SITE_SCREENS.changelog}>
      <span className="site-version">
        <SiteIcon name="cube" size={14} />
        <span className="site-version-label">Mokly CLI</span>
        <SiteChip mono tone="signal">
          {PACKAGE_VERSION}
        </SiteChip>
      </span>
    </MockLink>
  );
}

/** The foot of the tree: the Changelog link. */
export function DocsTreeFoot() {
  return (
    <div className="site-doc-tree-foot">
      <SitePanelRow
        icon="history"
        to={SITE_SCREENS.changelog}
        trailing={<SiteIcon name="arrowRight" size={14} />}
      >
        Changelog
      </SitePanelRow>
    </div>
  );
}

/** A CLI command's page, such as `serve`, whose title the tree sets in mono. */
function isCommand(title: string): boolean {
  return /^[a-z]+$/.test(title);
}

/**
 * Every section with its pages in order. A page that a mockup owns links
 * it; the page you are reading is the selected layer.
 */
export function DocsTreeSections({ page }: { page: DocsPage }) {
  return (
    <div className="site-doc-tree-scroll">
      {DOCS_SECTIONS.map((section) => (
        <div className="site-doc-section" key={section.title}>
          <p className="site-doc-section-head site-rubric">
            <span>{section.title}</span>
            <span aria-hidden="true" className="site-docs-section-count">
              {section.pages.length}
            </span>
          </p>
          <ul>
            {section.pages.map((title) => (
              <li key={title}>
                <SitePanelRow
                  current={
                    section.title === page.section && title === page.title
                      ? "page"
                      : undefined
                  }
                  icon="file"
                  to={docsPageScreen(section.title, title)}
                >
                  {isCommand(title) ? (
                    <span className="site-docs-command">{title}</span>
                  ) : (
                    title
                  )}
                </SitePanelRow>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The Layers panel beside the page frame. */
export function DocsLayers({ page }: { page: DocsPage }) {
  return (
    <SitePanel
      as="nav"
      className="site-doc-tree"
      foot={<DocsTreeFoot />}
      label="Documentation"
      meta="Docs"
      metaMono
      title="Layers"
    >
      <div className="site-docs-layers-top">
        <DocsSearch />
        <DocsVersion />
      </div>
      <DocsTreeSections page={page} />
    </SitePanel>
  );
}
