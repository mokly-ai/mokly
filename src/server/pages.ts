/** Served shell pages composed from the catalogue and shell views. */

import type { ManifestEntry } from "@mokly/viewer/data";
import {
  renderShellPage,
  renderViewer,
  toRouteTarget,
} from "@mokly/viewer/server";
import type { Catalogue, ShellContext, ShellView } from "@mokly/viewer/server";

/** Render the catalogue home page. */
export function homePage(catalogue: Catalogue, context: ShellContext): string {
  return renderHosted(catalogue, { kind: "home" }, context);
}

/** Render one screen, use case, or whole-document page. */
export function viewPage(
  entry: ManifestEntry,
  catalogue: Catalogue,
  context: ShellContext,
): string {
  const target = toRouteTarget(entry);
  const view: ShellView = target
    ? { kind: "target", target }
    : { kind: "missing", requested: "kind" in entry ? entry.title : "" };
  return renderHosted(catalogue, view, context);
}

/** Render a route-aware not-found page keeping navigation available. */
export function notFoundPage(
  detail: string,
  catalogue: Catalogue,
  context: ShellContext,
): string {
  return renderHosted(
    catalogue,
    { kind: "missing", requested: detail },
    context,
  );
}

/** All first-party routes pass their accepted public snapshot to viewer SSR. */
function renderHosted(
  catalogue: Catalogue,
  view: ShellView,
  context: ShellContext,
): string {
  return context.readModel
    ? renderViewer(
        { catalogue: context.readModel, baseUrl: "http://mokly.invalid" },
        { catalogue, view, context },
      )
    : renderShellPage(catalogue, view, context);
}
