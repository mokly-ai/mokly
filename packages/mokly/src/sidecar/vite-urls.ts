import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ViteFetchResult } from "../generated/sidecar/ViteFetchResult.js";

import type { ModulePaths } from "./module-paths.js";

export const viteEntry = "\0mokly-entry";
export const viteJsx = "\0mokly-jsx";
export const viteDependencyJsx = "\0mokly-jsx-dependency";
export const viteProductionJsx = "\0mokly-jsx-production";

export function viteCss(file: string): string {
  return "\0mokly-css:" + Buffer.from(file).toString("base64url");
}

/** All Vite root-relative URLs and query variants pass through this boundary. */
export function viteUrl(id: string): string {
  return id.startsWith("\0") ? `/@id/__x00__${id.slice(1)}` : id;
}

export function viteId(url: string): string {
  return url.startsWith("/@id/")
    ? url.slice("/@id/".length).replace("__x00__", "\0")
    : url;
}

/** A query selects its underlying file for confinement and module identity. */
export function viteFile(id: string): string | undefined {
  id = viteId(id);
  if (id.startsWith("\0mokly-css:"))
    return Buffer.from(id.slice("\0mokly-css:".length), "base64url").toString();
  if (id.startsWith("file://")) return fileURLToPath(new URL(id));
  if (id.startsWith("/@fs/")) {
    id = id.slice("/@fs/".length);
    if (!path.isAbsolute(id)) id = "/" + id;
  }
  const file = id.replace(/[?#].*$/, "");
  return path.isAbsolute(file) && !id.startsWith("\0") ? file : undefined;
}

export function fetchKey(url: string, importer?: string | null): string {
  return JSON.stringify([url, importer ?? null]);
}

/** Vite's runner uses the physical importer, also for a query variant. */
export function viteImporter(
  result: Extract<ViteFetchResult, { code: string }>,
): string {
  return result.file ?? result.id;
}

export function viteName(paths: Pick<ModulePaths, "name">, id: string): string {
  const file = viteFile(id);
  if (!file) return "entry module";
  try {
    return paths.name(file);
  } catch {
    return path.basename(file);
  }
}
