/**
 * The documentation's Inspect panel: the open page's properties, Edit on
 * GitHub, and On this page, the outline of the page's `h2` headings with
 * their indexes and the reading progress. Below the breakpoint the same
 * outline, properties and link sit under the lead in a native disclosure.
 */

import { guideSource, sectionIndex, type DocsPage } from "./docs-pages.js";
import { SiteIcon } from "./icons.js";
import { SiteChip } from "./labels.js";
import { SitePanel } from "./panel.js";
import { PACKAGE_VERSION } from "./version.js";

/** The page's properties and the link to its source on GitHub. */
function DocsFacts({ page }: { page: DocsPage }) {
  return (
    <>
      <dl className="site-docs-facts">
        <div className="site-docs-fact">
          <dt>Section</dt>
          <dd>{page.section}</dd>
        </div>
        <div className="site-docs-fact">
          <dt>Version</dt>
          <dd>
            <SiteChip mono tone="signal">
              {PACKAGE_VERSION}
            </SiteChip>
          </dd>
        </div>
        <div className="site-docs-fact">
          <dt>Package</dt>
          <dd>@mokly/mokly</dd>
        </div>
      </dl>
      <a className="site-docs-edit" href={guideSource(page.file)}>
        <SiteIcon name="github" size={14} />
        Edit on GitHub
        <SiteIcon name="external" size={14} />
      </a>
    </>
  );
}

/**
 * On this page: a link to each `h2`, the first marked as the section in
 * view, as the page reads from its top. `progress` heads the list with the
 * reading progress, as the Inspect panel shows it.
 */
function DocsOnThisPage({
  page,
  progress = false,
}: {
  page: DocsPage;
  progress?: boolean | undefined;
}) {
  return (
    <nav aria-label="On this page" className="site-onpage">
      {progress ? (
        <p className="site-docs-inspect-head">
          On this page
          <span aria-hidden="true" className="site-docs-progress">
            <span className="site-docs-progress-track" />
            0%
          </span>
        </p>
      ) : null}
      <ol>
        {page.sections.map((section, index) => (
          <li key={section.id}>
            <a
              aria-current={index === 0 ? "location" : undefined}
              className="site-onpage-link"
              href={`#${section.id}`}
            >
              <span aria-hidden="true" className="site-docs-index">
                {sectionIndex(index)}
              </span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The Inspect panel beside the page frame, named by the page's file. */
export function DocsInspect({ page }: { page: DocsPage }) {
  return (
    <SitePanel
      className="site-docs-inspect"
      meta={page.file.slice(page.file.lastIndexOf("/") + 1)}
      metaMono
      title="Inspect"
    >
      <div className="site-docs-inspect-section">
        <p className="site-docs-inspect-head">Page</p>
        <DocsFacts page={page} />
      </div>
      <div className="site-docs-inspect-section">
        <DocsOnThisPage page={page} progress />
      </div>
    </SitePanel>
  );
}

/**
 * Below the breakpoint: On this page as a native disclosure under the lead,
 * closed as each page opens, holding the outline, the page's properties and
 * Edit on GitHub.
 */
export function DocsOutline({ page }: { page: DocsPage }) {
  return (
    <details className="site-docs-outline">
      <summary className="site-docs-outline-summary">
        <SiteIcon name="outline" size={16} />
        On this page
        <span aria-hidden="true" className="site-docs-outline-count">
          {page.sections.length}
        </span>
        <SiteIcon
          className="site-docs-outline-chevron"
          name="chevronDown"
          size={16}
        />
      </summary>
      <div className="site-docs-outline-body">
        <DocsOnThisPage page={page} />
        <div className="site-docs-outline-facts">
          <DocsFacts page={page} />
        </div>
      </div>
    </details>
  );
}
