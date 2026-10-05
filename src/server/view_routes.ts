import type { ServerResponse } from "node:http";

import {
  isHistoricalSnapshotId,
  parseViewHref,
  resolveCatalogueSelection,
} from "@mokly/viewer/data";
import { catalogueRouteEntry } from "@mokly/viewer/server";
import type { Catalogue, ShellContext } from "@mokly/viewer/server";

import type { GeneratedFile } from "../build/generated_file.js";
import type { ResolvedConfig } from "../config/types.js";

import type { DocumentService } from "./demand/service.js";
import { requestedFragment } from "./fragments.js";
import { notFoundPage, viewPage } from "./pages.js";
import { send } from "./respond.js";

export async function renderView(
  response: ServerResponse,
  url: URL,
  encodedRoute: string,
  catalogue: Catalogue,
  config: ResolvedConfig,
  context: ShellContext,
  method: string,
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>,
): Promise<void> {
  const identity = parseViewHref(`/view/${encodedRoute}`);
  const snapshots = url.searchParams.getAll("snapshot");
  const requestedSnapshot = snapshots.length === 1 ? snapshots[0] : undefined;
  if (
    snapshots.length > 1 ||
    (requestedSnapshot !== undefined &&
      !isHistoricalSnapshotId(requestedSnapshot))
  )
    return send(
      response,
      400,
      "text/plain",
      "This version is unavailable.",
      method,
    );
  const selected =
    identity && context.readModel
      ? resolveCatalogueSelection(
          context.readModel,
          identity,
          requestedSnapshot,
        )
      : undefined;
  const entry = identity
    ? context.readModel
      ? selected
        ? selected.snapshotId
          ? catalogue.removedEntries.find(
              ({ entry: candidate }) =>
                candidate.path === selected.entry.path &&
                candidate.kind === selected.entry.kind,
            )?.entry
          : catalogueRouteEntry(
              catalogue,
              selected.entry.path,
              selected.entry.kind,
            )
        : undefined
      : requestedSnapshot === undefined
        ? catalogueRouteEntry(catalogue, identity)
        : undefined
    : undefined;
  if (!entry)
    return send(
      response,
      404,
      "text/html",
      notFoundPage(encodedRoute, catalogue, context),
      method,
    );
  const manifestEntry = "kind" in entry ? entry : undefined;
  const removed = context.readModel
    ? selected?.snapshotId !== undefined
    : catalogue.removedEntries.some(
        ({ entry: candidate }) => candidate === entry,
      );
  const fragment = removed
    ? url.searchParams.has("fragment")
      ? null
      : undefined
    : await requestedFragment(
        url,
        manifestEntry,
        catalogue,
        documents,
        generatedOutputs,
      );
  if (fragment === null) {
    return send(response, 400, "text/plain", "Invalid fragment query", method);
  }
  const viewContext = {
    ...context,
    activeId: entry.path,
    ...(fragment ? { fragment } : {}),
    ...(selected?.snapshotId ? { snapshotId: selected.snapshotId } : {}),
  };
  return send(
    response,
    200,
    "text/html",
    viewPage(entry, catalogue, viewContext),
    method,
  );
}
