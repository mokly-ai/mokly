/** The same-origin routes of the standalone shell that Serve and `build` deliver. */

import {
  entryDetailPath,
  INDEX_PATH,
  removedEntryDetailPath,
} from "../catalogue/delivery_paths.js";
import { readCatalogueIndex } from "../catalogue/index_reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ShellDataSource } from "../shell/data_source.js";
import {
  DeliveryFetchError,
  fetchJson,
  loadDetailResult,
  type JsonFetch,
} from "../viewer/sources.js";

import { standaloneLiveSource } from "./live_source.js";

/** The browser surface the standalone transports use. */
export interface StandaloneWindow {
  location: { href: string; reload(): void };
  fetch: JsonFetch;
  EventSource?: typeof EventSource | undefined;
}

/** Fetch the index the stub's origin serves. */
export async function fetchStandaloneIndex(
  win: StandaloneWindow,
  signal: AbortSignal,
): Promise<CatalogueReadModel> {
  const root = new URL("/", win.location.href);
  const { value } = await fetchJson(
    new URL(INDEX_PATH, root),
    signal,
    win.fetch,
  );
  return readCatalogueIndex(value);
}

/** Read the index, details and live routes of the stub's own origin. */
export function standaloneDataSource(win: StandaloneWindow): ShellDataSource {
  const root = new URL("/", win.location.href);
  return {
    loadIndex: (signal) => fetchStandaloneIndex(win, signal),
    loadDetail(request, index, signal) {
      if (request.snapshotId !== undefined && index.comparisonUrl === null)
        return Promise.reject(new DeliveryFetchError());
      const path =
        request.snapshotId === undefined
          ? entryDetailPath(request.path)
          : removedEntryDetailPath(index.comparisonUrl!, request.path);
      return loadDetailResult(new URL(path, root), root, signal, win.fetch);
    },
    deploymentChanged() {
      win.location.reload();
    },
    live: standaloneLiveSource(win),
  };
}
