export { acceptedShellEvidence } from "./shell/accepted_inputs.js";
export { catalogueRouteEntry, createCatalogue } from "./shell/catalogue.js";
export type { Catalogue } from "./shell/catalogue.js";
export { shellContext } from "./shell/context.js";
export type { ShellContext } from "./shell/context.js";
export { SHELL_CSS } from "./shell/css.js";
export { renderHydratedShellPage, renderShellPage } from "./shell/document.js";
export { toRouteTarget } from "./shell/target.js";
export type { ShellGeneratedView } from "./shell/usage_types.js";
export type { ShellView } from "./shell/views.js";
export type { WorkspaceData } from "./shell/workspace_data.js";
export { renderViewer } from "./viewer/server.js";
export type {
  ServerViewerProps,
  ViewerServerContext,
} from "./viewer/server.js";

/** Resolve only package-owned static assets, independently of the host install layout. */
export function viewerAssetUrl(
  kind: "browser" | "navigation" | "fonts",
  filename: string,
): URL {
  if (!/^[A-Za-z0-9_.-]+$/.test(filename))
    throw new Error("Invalid viewer asset name");
  return new URL(
    `${kind === "fonts" ? "assets/fonts" : kind}/${filename}`,
    import.meta.url,
  );
}
