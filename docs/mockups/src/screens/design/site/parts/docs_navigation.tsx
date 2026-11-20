/**
 * The documentation navigation. The tree sits on the page canvas rather than
 * in a filled panel: the version label heads it, every section is listed
 * expanded under a rubric head, page rows are full-height targets and the
 * page you are reading carries the shell's quiet accent fill.
 */

import { MockLink } from "@mokly/mokly";

import { SiteVersion } from "./chrome.js";
import { DOCS_HEADINGS, DOCS_PAGE, DOCS_SECTIONS } from "./docs_data.js";
import { SITE_SCREENS } from "./links.js";

function TreeBody() {
  return (
    <>
      <MockLink className="site-version-link" to={SITE_SCREENS.changelog}>
        <SiteVersion label="Mokly CLI" />
      </MockLink>
      <div className="site-doc-tree-scroll">
        {DOCS_SECTIONS.map((section) => (
          <div className="site-doc-section" key={section.title}>
            <p className="site-doc-section-head site-rubric">{section.title}</p>
            <ul>
              {section.pages.map((page) =>
                page === DOCS_PAGE.page ? (
                  <li key={page}>
                    <MockLink
                      aria-current="page"
                      className="site-doc-link site-doc-link--current"
                      to={SITE_SCREENS.docs}
                    >
                      {page}
                    </MockLink>
                  </li>
                ) : (
                  <li className="site-doc-link" key={page}>
                    {page}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="site-doc-tree-foot">
        <MockLink className="site-doc-link" to={SITE_SCREENS.changelog}>
          Changelog
        </MockLink>
      </div>
    </>
  );
}

/** The tree beside the document, hung on the page's own vertical hairline. */
export function DocsTree() {
  return (
    <div className="site-docs-side">
      <nav aria-label="Documentation" className="site-doc-tree">
        <TreeBody />
      </nav>
    </div>
  );
}

/** Below the breakpoint the tree collapses into a disclosure. */
export function DocsTreeDisclosure() {
  return (
    <details className="site-doc-disclosure">
      <summary>
        {DOCS_PAGE.section}
        <span aria-hidden="true" className="site-trail-sep">
          &#8250;
        </span>
        {DOCS_PAGE.page}
      </summary>
      <nav aria-label="Documentation" className="site-doc-tree">
        <TreeBody />
      </nav>
    </details>
  );
}

/** The on-this-page rail, generated from the document's own headings. */
export function DocsOnThisPage() {
  return (
    <nav aria-labelledby="on-this-page" className="site-onpage">
      <h2 className="site-rubric" id="on-this-page">
        On this page
      </h2>
      <ol>
        {DOCS_HEADINGS.map((heading) => (
          <li key={heading.id}>
            <a className="site-onpage-link" href={`#${heading.id}`}>
              {heading.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Previous and next follow sidebar order across section boundaries. */
export function DocsPager() {
  return (
    <nav aria-label="Pagination" className="site-pager">
      <span className="site-pager-item">
        <span className="site-pager-label site-rubric">Previous</span>
        Getting started
      </span>
      <span className="site-pager-item site-pager-item--next">
        <span className="site-pager-label site-rubric">Next</span>
        Configure
      </span>
    </nav>
  );
}
