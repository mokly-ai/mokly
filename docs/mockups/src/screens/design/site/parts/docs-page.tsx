/**
 * The open guide as a page frame on the canvas, selected because the page
 * is the selected layer: the trail as the mono eyebrow, the title and the
 * lead with its green rule, then each `h2` section ruled across the sheet
 * with its index hung in the margin, and previous and next as two small
 * frames. On this page also sits under the lead as a disclosure, which the
 * compositions show where the Inspect panel is not drawn.
 */

import { classNames } from "./class-names.js";
import { DocsOutline } from "./docs-inspect.js";
import {
  sectionIndex,
  type DocsNeighbour,
  type DocsPage,
} from "./docs-pages.js";
import { SiteIcon } from "./icons.js";
import { SitePageFrame } from "./page-frame.js";
import { SiteTrail } from "./trail.js";

/**
 * One frame of the pager: its label above it, then the page's section,
 * title and description. No mockup owns the neighbouring pages, so the
 * frame is plain text.
 */
function DocsPagerItem({
  neighbour,
  next,
}: {
  neighbour: DocsNeighbour;
  next: boolean;
}) {
  return (
    <span
      className={classNames("site-pager-item", next && "site-pager-item--next")}
    >
      <span className="site-pager-label">
        {next ? null : <SiteIcon name="arrowLeft" size={13} />}
        {next ? "Next" : "Previous"}
        {next ? <SiteIcon name="arrowRight" size={13} /> : null}
      </span>
      <span className="site-docs-pager-section">{neighbour.section}</span>
      <span className="site-docs-pager-title">{neighbour.title}</span>
      <span className="site-docs-pager-description">
        {neighbour.description}
      </span>
    </span>
  );
}

/** Previous and next, in the order of the reading sequence. */
function DocsPager({ page }: { page: DocsPage }) {
  return (
    <nav aria-label="Pagination" className="site-pager">
      <DocsPagerItem neighbour={page.previous} next={false} />
      <DocsPagerItem neighbour={page.next} next />
    </nav>
  );
}

/** The page frame with the guide in it, for one composition. */
export function DocsPageFrame({
  desktop,
  page,
}: {
  desktop: boolean;
  page: DocsPage;
}) {
  return (
    <SitePageFrame
      className="site-docs-frame"
      file={page.file}
      size={page.size[desktop ? "desktop" : "mobile"]}
    >
      <div className="site-document-intro">
        <SiteTrail trail={["Documentation", page.section]} />
        <h1>{page.title}</h1>
        <p className="site-pullquote">{page.description}</p>
      </div>
      <DocsOutline page={page} />
      <div className="site-document-body">
        {page.sections.map((section, index) => (
          <section key={section.id}>
            <span aria-hidden="true" className="site-docs-section-index">
              {sectionIndex(index)}
            </span>
            <h2 id={section.id}>{section.title}</h2>
            {section.body}
          </section>
        ))}
      </div>
      <DocsPager page={page} />
    </SitePageFrame>
  );
}
