/** Server rendering for the complete standalone shell document. */

import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  shellBootstrap,
  shellBootstrapProps,
} from "../standalone/bootstrap.js";
import { StandaloneShellDocument } from "../standalone/document.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellView } from "./views.js";

/** Render one full Mokly shell page to an HTML document string. */
export function renderShellPage(
  catalogue: Catalogue,
  view: ShellView,
  context: ShellContext,
): string {
  const markup = renderToStaticMarkup(
    <StandaloneShellDocument
      catalogue={catalogue}
      context={context}
      view={view}
    />,
  );
  return `<!doctype html>\n${markup}\n`;
}

/** Render the switched document from the same public state the browser hydrates. */
export function renderHydratedShellPage(
  view: ShellView,
  context: ShellContext,
): string {
  if (!context.readModel)
    throw new Error("Hydrated shell rendering requires a public catalogue.");
  const bootstrap = shellBootstrap(context.readModel, view, context);
  const props = shellBootstrapProps(bootstrap);
  const markup = renderToString(
    <StandaloneShellDocument {...props} bootstrap={bootstrap} />,
  );
  return `<!doctype html>\n${markup}\n`;
}
