import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";

import type { CatalogueSource } from "./types.js";

export interface LoadedCatalogue {
  catalogue: CatalogueReadModel;
  url: URL;
}
/** Catalogue locations carry neither credentials nor fragments. */
export function catalogueUrl(value: string | URL): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("The catalogue address is unavailable.");
  return url;
}
export function objectSource(
  source: CatalogueSource,
): source is CatalogueReadModel {
  return typeof source === "object" && !(source instanceof URL);
}
export function sourceIdentity(source: CatalogueSource): CatalogueSource {
  return source instanceof URL ? source.href : source;
}
export function readObjectSource(
  source: CatalogueSource,
  baseUrl?: string | URL,
): LoadedCatalogue | undefined {
  if (!objectSource(source)) {
    if (baseUrl !== undefined)
      throw new Error("Only a catalogue object accepts a base address.");
    return;
  }
  if (!baseUrl) throw new Error("The catalogue needs its artifact address.");
  return {
    catalogue: readCatalogue(source),
    url: new URL("/", catalogueUrl(baseUrl)),
  };
}
export async function loadSource(
  source: CatalogueSource,
  baseUrl: string | URL | undefined,
  signal: AbortSignal,
): Promise<LoadedCatalogue> {
  const ready = readObjectSource(source, baseUrl);
  if (ready) return ready;
  if (typeof source === "function") {
    const result = await source({ signal });
    signal.throwIfAborted();
    return {
      catalogue: readCatalogue(result.catalogue),
      url: new URL("/", catalogueUrl(result.url)),
    };
  }
  if (objectSource(source))
    throw new Error("The catalogue could not be loaded.");
  const url = catalogueUrl(source);
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok || catalogueUrl(response.url).origin !== url.origin)
    throw new Error("The catalogue could not be loaded.");
  const catalogue = readCatalogue(await response.json());
  signal.throwIfAborted();
  return { catalogue, url: new URL("/", response.url) };
}
