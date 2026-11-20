/**
 * The documentation page: search sits in the header, the tree sits
 * on the page canvas behind a vertical hairline, and the document keeps a
 * ruled reading structure — an accent-ruled lead, hairlines between the
 * intro, the body and the previous and next row, and its own on-this-page
 * rail hung from a hairline at the outer edge.
 */

import { SiteLayout, SiteTrail } from "./parts/chrome.js";
import { CodePanel } from "./parts/code_panel.js";
import { DOCS_HEADINGS, DOCS_PAGE } from "./parts/docs_data.js";
import {
  DocsOnThisPage,
  DocsPager,
  DocsTree,
  DocsTreeDisclosure,
} from "./parts/docs_navigation.js";
import { SITE_SCREENS } from "./parts/links.js";

function SiteDocs({ viewport }: { viewport: "mobile" | "desktop" }) {
  const desktop = viewport === "desktop";
  return (
    <SiteLayout active={SITE_SCREENS.docs} search viewport={viewport}>
      <div className="site-docs">
        {desktop ? <DocsTree /> : <DocsTreeDisclosure />}
        <main className="site-document site-docs-document" id="main">
          <div className="site-document-intro">
            <SiteTrail trail={["Documentation", DOCS_PAGE.section]} />
            <h1>{DOCS_PAGE.page}</h1>
            <p className="site-pullquote">
              Add Mokly to the repository that holds your components.
            </p>
          </div>
          {desktop ? null : <DocsOnThisPage />}
          <div className="site-document-body">
            <section id={DOCS_HEADINGS[0].id}>
              <h2>{DOCS_HEADINGS[0].title}</h2>
              <p>
                Mokly runs from your repository as a development dependency.
                Screens written in React also need React and React DOM.
              </p>
              <CodePanel
                code="npm install --save-dev @mokly/mokly react react-dom"
                language="shell"
              />
            </section>
            <section id={DOCS_HEADINGS[1].id}>
              <h2>{DOCS_HEADINGS[1].title}</h2>
              <p>
                Create <code>mokly.config.json</code> at the repository root.
                Set <code>roots</code> to the folders holding your entry
                modules. By default, a build writes the static catalogue to{" "}
                <code>mokly-static</code>. Keep that folder ignored by Git.
              </p>
            </section>
            <section id={DOCS_HEADINGS[2].id}>
              <h2>{DOCS_HEADINGS[2].title}</h2>
              <p>
                Add an entry module ending in <code>.mockup.tsx</code> whose
                default export is a <code>defineScreen</code>. Mokly calls its{" "}
                <code>render</code> for the mobile and the desktop view.
              </p>
            </section>
          </div>
          <DocsPager />
        </main>
        {desktop ? (
          <div className="site-docs-rail">
            <DocsOnThisPage />
          </div>
        ) : null}
      </div>
    </SiteLayout>
  );
}

/** The documentation screen, with its composition selected by the viewport. */
export function SiteDocsScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteDocs viewport={viewport} />;
}
