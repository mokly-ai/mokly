import { isSafeCatalogueRoute } from "../data/paths.js";
import {
  GENERATED_DIRECTORY,
  VIEWER_DIRECTORY,
} from "../generated/catalogue/Namespace.js";

export { VIEWER_DIRECTORY };

/** Map a logical document route to the fixed current static path. */
export function currentDocumentPath(route: string): string {
  return `static/${GENERATED_DIRECTORY}/${route}`;
}

/** Reject paths outside current generated documents before handing a route to the shell. */
export function currentDocumentRoute(pathname: string): string | undefined {
  if (/%2f|%5c/i.test(pathname)) return;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return;
  }
  const root = `/${currentDocumentPath("")}`;
  if (!decoded.startsWith(root)) return;
  const route = decoded.slice(root.length);
  return isSafeCatalogueRoute(route) ? route : undefined;
}

/** The route prefix of every temporary live render preview. */
export const RENDERS_PATH = `${VIEWER_DIRECTORY}/components/renders` as const;

/** An opaque render id that Serve chooses: one URL-safe path segment. */
export const RENDER_ID = /^[A-Za-z0-9._~-]{1,256}$/;
