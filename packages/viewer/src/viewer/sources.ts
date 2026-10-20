/** Index and detail sources and the fetch rules of the shell delivery contract. */

import { readEntryDetail } from "../catalogue/detail_reader.js";
import { readCatalogueIndex } from "../catalogue/index_reader.js";
import type { CatalogueReadModel, EntryDetailV2 } from "../catalogue/types.js";

/** The catalogue index v7 as an object, or its absolute HTTP(S) URL. */
export type IndexSource = CatalogueReadModel | string | URL;
/** One entry detail v2 as an object, or its URL on the artifact origin. */
export type DetailResult = EntryDetailV2 | string | URL;
/** One entry detail v2, or its URL; a removed entry names its snapshot. */
export type DetailSource = (
  entryPath: string,
  snapshotId?: string,
) => DetailResult | Promise<DetailResult>;

/** A JSON route that failed one of the delivery fetch rules. */
export class DeliveryFetchError extends Error {
  constructor(message = "The catalogue data could not be loaded.") {
    super(message);
    this.name = "DeliveryFetchError";
  }
}

/** A source URL is HTTP(S) without userinfo or fragment. */
export function sourceUrl(value: string | URL): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new DeliveryFetchError("The catalogue address is unavailable.");
  return url;
}

/** The fetch function a source uses, injectable for tests. */
export type JsonFetch = (input: URL, init: RequestInit) => Promise<Response>;

/**
 * An ordinary same-origin GET without custom headers or credentials. A
 * redirect outside the origin, a failure status, or another content type fail.
 */
export async function fetchJson(
  url: URL,
  signal: AbortSignal,
  fetchImpl: JsonFetch = (input, init) => fetch(input, init),
): Promise<{ value: unknown; url: URL }> {
  const response = await fetchImpl(url, { credentials: "omit", signal });
  const final = new URL(response.url || url.href);
  const type = response.headers.get("content-type") ?? "";
  if (
    !response.ok ||
    final.origin !== url.origin ||
    !/^application\/json(?:\s*;|$)/i.test(type.trim())
  )
    throw new DeliveryFetchError();
  const value: unknown = await response.json();
  signal.throwIfAborted();
  return { value, url: final };
}

/** One validated index and the origin root its artifact paths resolve at. */
export interface LoadedIndex {
  index: CatalogueReadModel;
  root: URL;
}

/** Validate an object source with its base URL, or fetch a URL source. */
export async function loadIndexSource(
  source: IndexSource,
  baseUrl: string | URL | undefined,
  signal: AbortSignal,
  fetchImpl?: JsonFetch,
): Promise<LoadedIndex> {
  if (typeof source === "object" && !(source instanceof URL)) {
    if (baseUrl === undefined)
      throw new DeliveryFetchError("The catalogue needs its artifact address.");
    return {
      index: readCatalogueIndex(source),
      root: new URL("/", sourceUrl(baseUrl)),
    };
  }
  if (baseUrl !== undefined)
    throw new DeliveryFetchError(
      "Only a catalogue object accepts a base address.",
    );
  const { value, url } = await fetchJson(sourceUrl(source), signal, fetchImpl);
  return { index: readCatalogueIndex(value), root: new URL("/", url) };
}

/** Resolve one detail result, fetching a URL only on the artifact origin. */
export async function loadDetailResult(
  result: DetailResult,
  root: URL,
  signal: AbortSignal,
  fetchImpl?: JsonFetch,
): Promise<EntryDetailV2> {
  if (typeof result === "object" && !(result instanceof URL))
    return readEntryDetail(result);
  const url = sourceUrl(new URL(result, root));
  if (url.origin !== root.origin) throw new DeliveryFetchError();
  const { value } = await fetchJson(url, signal, fetchImpl);
  return readEntryDetail(value);
}
