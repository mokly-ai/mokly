/** Load and validate the index source of one mounted viewer. */

import { useEffect, useMemo, useState } from "react";

import { readCatalogueIndex } from "../catalogue/index_reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ShellDataSource } from "../shell/data_source.js";

import {
  DeliveryFetchError,
  loadDetailResult,
  loadIndexSource,
  sourceUrl,
  type DetailSource,
  type IndexSource,
  type LoadedIndex,
} from "./sources.js";

/** The identity whose change remounts the shell: object, URL value, or origin. */
function sourceIdentity(
  source: IndexSource,
  baseUrl: string | URL | undefined,
): readonly unknown[] {
  let origin: string | undefined;
  try {
    origin = baseUrl === undefined ? undefined : sourceUrl(baseUrl).origin;
  } catch {
    origin = String(baseUrl);
  }
  return [source instanceof URL ? source.href : source, origin];
}

/** One load of an index source, with retry; an object validates at once. */
export function useIndexSource(
  source: IndexSource,
  baseUrl: string | URL | undefined,
) {
  const [retry, setRetry] = useState(0);
  const [first, second] = sourceIdentity(source, baseUrl);
  const key = useMemo(() => ({ retry }), [first, second, retry]);
  const immediate = useMemo(() => {
    if (!isObjectSource(source)) return undefined;
    try {
      return { loaded: readObjectSource(source, baseUrl) };
    } catch (cause) {
      return { error: { cause } };
    }
  }, [key]);
  const [result, setResult] = useState<{
    key: typeof key;
    loaded?: LoadedIndex;
    error?: { cause: unknown };
  }>();
  useEffect(() => {
    if (immediate) return;
    const controller = new AbortController();
    // StrictMode discards its first effect before this turn. Do not start its transport.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void loadIndexSource(source, baseUrl, controller.signal).then(
        (loaded) => {
          if (!controller.signal.aborted) setResult({ key, loaded });
        },
        (cause: unknown) => {
          if (!controller.signal.aborted) setResult({ key, error: { cause } });
        },
      );
    });
    return () => controller.abort();
  }, [immediate, key]);
  const current = immediate ?? (result?.key === key ? result : undefined);
  return {
    key,
    ...(current?.loaded ? { loaded: current.loaded } : {}),
    ...(current?.error ? { error: current.error } : {}),
    retry: () => setRetry((value) => value + 1),
  };
}

function isObjectSource(source: IndexSource): source is CatalogueReadModel {
  return typeof source === "object" && !(source instanceof URL);
}

function readObjectSource(
  source: CatalogueReadModel,
  baseUrl: string | URL | undefined,
): LoadedIndex {
  if (baseUrl === undefined)
    throw new DeliveryFetchError("The catalogue needs its artifact address.");
  return {
    index: readCatalogueIndex(source),
    root: new URL("/", sourceUrl(baseUrl)),
  };
}

/** The transports of an embedded viewer: its index and detail sources. */
export function embeddedDataSource(
  source: IndexSource,
  loaded: LoadedIndex,
  detail: DetailSource,
  events: { deploymentChanged(): void; detailFailed(): void },
): ShellDataSource {
  return {
    async loadIndex(signal): Promise<CatalogueReadModel> {
      if (isObjectSource(source)) return loaded.index;
      return (await loadIndexSource(source, undefined, signal)).index;
    },
    async loadDetail(request, _index, signal) {
      const result = await detail(request.path, request.snapshotId);
      signal.throwIfAborted();
      return loadDetailResult(result, loaded.root, signal);
    },
    deploymentChanged: () => events.deploymentChanged(),
    detailFailed: () => events.detailFailed(),
  };
}
