import { isSafeCatalogueRoute } from "../data/paths.js";

export type GeneratedPathPrefix = ".generated" | undefined;

/** Map a logical document route to the selected publication's static path. */
export function currentDocumentPath(
  route: string,
  prefix?: GeneratedPathPrefix,
): string {
  return `static/${prefix ? `${prefix}/` : ""}${route}`;
}

/** Reject cross-layout frame navigation before handing a route to the shell. */
export function currentDocumentRoute(
  pathname: string,
  prefix?: GeneratedPathPrefix,
): string | undefined {
  if (/%2f|%5c/i.test(pathname)) return;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return;
  }
  const root = `/${currentDocumentPath("", prefix)}`;
  if (!decoded.startsWith(root)) return;
  const route = decoded.slice(root.length);
  return isSafeCatalogueRoute(route) ? route : undefined;
}
