// Server-side full-document rendering for the served Mokly shell. Full
// pages keep one persistent frame — top bar, catalogue navigation, and status
// region — around the route-owned main view that progressive navigation
// replaces.

import { renderToStaticMarkup } from "react-dom/server";

import { normalizeTheme } from "../viewer/theme.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { CatalogueNav } from "./nav.js";
import { TopBar } from "./top_bar.js";
import { ShellMain, viewTitle } from "./views.js";
import type { ShellView } from "./views.js";

/** Render one full Mokly shell page to an HTML document string. */
export function renderShellPage(
  catalogue: Catalogue,
  view: ShellView,
  context: ShellContext,
): string {
  const markup = renderToStaticMarkup(
    <html
      data-mokly-base={context.base}
      data-mokly-static={context.delivery ? "" : undefined}
      data-mokly-delivery={
        context.delivery ? JSON.stringify(context.delivery) : undefined
      }
      data-mokly-appearance=""
      data-mokly-theme={normalizeTheme(context.theme)}
      data-mokly-update-version={context.updateVersion}
      data-mokly-content-version={
        context.delivery ? undefined : context.contentVersion
      }
      lang="en"
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>{viewTitle(catalogue, view)}</title>
        {/* Classic and ahead of the stylesheet, so a stored or pinned dark
            appearance is on the root before the first paint. */}
        <script src="/__mokly/client/appearance-startup.js" />
        <link href="/__mokly/shell.css" rel="stylesheet" />
      </head>
      <body className="mbk-fs">
        <div className="mbk" data-drawer="closed" data-mokly-shell="">
          <a className="mbk-skip-link" href="#mb-main">
            Skip to content
          </a>
          <TopBar catalogue={catalogue} context={context} />
          <div className="mbk-body">
            <CatalogueNav catalogue={catalogue} context={context} />
            <ShellMain catalogue={catalogue} context={context} view={view} />
          </div>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="mbk-route-status"
            id="mb-status"
            role="status"
          />
        </div>
        <script src="/__mokly/client/navigation-resize.js" />
        <script src="/__mokly/client/browse.js" type="module" />
        {!context.delivery ? (
          <script src="/__mokly/client/browser.js" type="module" />
        ) : null}
      </body>
    </html>,
  );
  return `<!doctype html>\n${markup}\n`;
}
