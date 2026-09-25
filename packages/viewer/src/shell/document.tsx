/** Server rendering for the complete standalone shell document. */

import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  serializeViewerCapabilityDescriptor,
  viewerCapabilityDescriptor,
} from "../client/host_capability_descriptor.js";
import {
  externalShellBootstrap,
  serializeShellBootstrap,
  shellBootstrap,
  shellBootstrapProps,
} from "../standalone/bootstrap.js";
import { StandaloneShellDocument } from "../standalone/document.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellView } from "./views.js";
import { workspaceData } from "./workspace_data.js";

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

/** Render the hydrated document from the same public state the browser adopts. */
export function renderHydratedShellPage(
  view: ShellView,
  context: ShellContext,
  privateCatalogue?: Catalogue,
): string {
  if (!context.readModel)
    throw new Error("Hydrated shell rendering requires a public catalogue.");
  const resolvedBootstrap = shellBootstrap(context.readModel, view, context);
  const bootstrap = context.delivery
    ? externalShellBootstrap(resolvedBootstrap)
    : resolvedBootstrap;
  const initialWorkspace =
    privateCatalogue &&
    view.kind === "target" &&
    view.target.kind === "entry" &&
    (view.target.entry.kind === "screen" ||
      view.target.entry.kind === "component")
      ? workspaceData(privateCatalogue, context, view.target.entry)
      : undefined;
  const capabilityDescriptor = viewerCapabilityDescriptor(
    context.readModel,
    context,
    initialWorkspace,
  );
  const bootstrapJson = serializeShellBootstrap(bootstrap);
  const capabilityDescriptorJson = capabilityDescriptor
    ? serializeViewerCapabilityDescriptor(capabilityDescriptor)
    : undefined;
  const props = shellBootstrapProps(resolvedBootstrap);
  const markup = renderToString(
    <StandaloneShellDocument
      {...props}
      bootstrapJson={bootstrapJson}
      {...(capabilityDescriptor ? { capabilityDescriptor } : {})}
      {...(capabilityDescriptorJson ? { capabilityDescriptorJson } : {})}
      {...(initialWorkspace ? { initialWorkspace } : {})}
    />,
  );
  return `<!doctype html>\n${markup}\n`;
}
