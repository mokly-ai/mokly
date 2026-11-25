/**
 * The documentation page as a part of the design file: the open guide is a
 * page frame on the canvas between two floating panels, Layers, the section
 * tree with its search, and Inspect, the page's properties and outline.
 * Below the breakpoint a sub-bar under the tool bar names the section and
 * the page, opens the tree as a sheet and opens search, and the page frame
 * fills the canvas with a narrow margin. The desktop composition draws the
 * sub-bar and the page's On this page disclosure too; its narrower desktop
 * steps show them in place of the panels.
 */

import "./styles/shared.js";
import "./styles/docs.js";

import { SiteLayout } from "./parts/chrome.js";
import {
  FIRST_SCREEN_DESKTOP_PAGE,
  FIRST_SCREEN_PAGE,
} from "./parts/docs-first-screen.js";
import { DocsInspect } from "./parts/docs-inspect.js";
import { INSTALL_PAGE } from "./parts/docs-install.js";
import { DocsPageFrame } from "./parts/docs-page.js";
import type { DocsPage } from "./parts/docs-pages.js";
import { DocsLayersSheet, DocsSubbar } from "./parts/docs-sheet.js";
import { DocsLayers } from "./parts/docs_navigation.js";
import { SITE_SCREENS } from "./parts/links.js";

type Viewport = "mobile" | "desktop";

/**
 * One documentation page in one composition. `layers` draws the mobile
 * tree sheet open; the desktop composition keeps the tree in its panel and
 * its sub-bar closed, so its view matches the documentation page.
 */
function SiteDocs({
  layers = false,
  page,
  viewport,
}: {
  layers?: boolean | undefined;
  page: DocsPage;
  viewport: Viewport;
}) {
  const desktop = viewport === "desktop";
  return (
    <SiteLayout active={SITE_SCREENS.docs} viewport={viewport}>
      <DocsSubbar open={layers && !desktop} page={page} />
      {layers && !desktop ? <DocsLayersSheet page={page} /> : null}
      <div className="site-docs">
        {desktop ? (
          <div className="site-docs-side">
            <DocsLayers page={page} />
          </div>
        ) : null}
        <main className="site-document site-docs-document" id="main">
          <DocsPageFrame desktop={desktop} page={page} />
        </main>
        {desktop ? (
          <div className="site-docs-rail">
            <DocsInspect page={page} />
          </div>
        ) : null}
      </div>
    </SiteLayout>
  );
}

/** The Install guide, where Docs leads. */
export function SiteDocsScreen({ viewport }: { viewport: Viewport }) {
  return <SiteDocs page={INSTALL_PAGE} viewport={viewport} />;
}

/** The Your first screen guide, with its HTML sample fence. */
export function SiteDocsFirstScreen({ viewport }: { viewport: Viewport }) {
  return <SiteDocs page={FIRST_SCREEN_PAGE} viewport={viewport} />;
}

/** The Your first screen guide, its HTML sample showing the Desktop view. */
export function SiteDocsFirstScreenDesktop({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SiteDocs page={FIRST_SCREEN_DESKTOP_PAGE} viewport={viewport} />;
}

/** The Install guide with the mobile tree sheet open over it. */
export function SiteDocsLayersScreen({ viewport }: { viewport: Viewport }) {
  return <SiteDocs layers page={INSTALL_PAGE} viewport={viewport} />;
}
