/** Complete standalone shell document shared by static SSR and hydration. */

import { useEffect } from "react";

import type { Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { CatalogueNav } from "../shell/nav.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain, viewTitle } from "../shell/views.js";
import type { ShellView } from "../shell/views.js";

import type { ShellBootstrap } from "./bootstrap.js";

export const REACT_SHELL_BUNDLE = "react-shell.js";

/** Render the standalone document without changing the existing shell tree. */
export function StandaloneShellDocument({
  bootstrap,
  catalogue,
  context,
  view,
}: {
  bootstrap?: ShellBootstrap;
  catalogue: Catalogue;
  context: ShellContext;
  view: ShellView;
}) {
  const hydrated = bootstrap !== undefined;
  return (
    <html
      data-mokly-base={context.base}
      data-mokly-static={context.delivery ? "" : undefined}
      data-mokly-delivery={
        context.delivery ? JSON.stringify(context.delivery) : undefined
      }
      data-mokly-update-version={context.updateVersion}
      data-mokly-content-version={
        context.delivery ? undefined : context.contentVersion
      }
      data-mokly-react-shell={hydrated ? "" : undefined}
      lang="en"
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>{viewTitle(catalogue, view)}</title>
        {hydrated ? <link href="data:," rel="icon" /> : null}
        <link href="/__mokly/shell.css" rel="stylesheet" />
      </head>
      <body className="mbk-fs">
        <div className="mbk" data-drawer="closed" data-mokly-shell="">
          <a className="mbk-skip-link" href="#mb-main">
            Skip to content
          </a>
          <TopBar catalogue={catalogue} />
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
        {bootstrap ? (
          <script
            data-mokly-shell-bootstrap=""
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(bootstrap).replaceAll("<", "\\u003c"),
            }}
          />
        ) : null}
        <script src="/__mokly/client/navigation-resize.js" />
        <script
          src={`/__mokly/client/${hydrated ? REACT_SHELL_BUNDLE : "browse.js"}`}
          type="module"
        />
        {!hydrated && !context.delivery ? (
          <script src="/__mokly/client/browser.js" type="module" />
        ) : null}
        {hydrated ? <HydrationMarker /> : null}
      </body>
    </html>
  );
}

function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset["moklyHydrated"] = "";
  }, []);
  return null;
}
