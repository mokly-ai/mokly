/** The protocol's catalogue index and entry detail fixtures as the shell reads them. */

import fs from "node:fs";

import {
  detailKey,
  type DetailRequest,
} from "../src/catalogue/detail_fences.js";
import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../src/catalogue/scoped_types.js";
import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

/** The detail fixtures: current entries by path, removed ones by snapshot id. */
export interface DetailFixtures {
  current: Record<string, EntryDetailV4>;
  removed: Record<string, EntryDetailV4>;
}

function fixtureJson(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      new URL(`../../../docs/protocol/fixtures/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

/** A fresh, mutable copy of the index fixture before validation. */
export function rawIndexFixture(): CatalogueReadModel {
  return structuredClone(
    fixtureJson("catalogue-v9.json"),
  ) as CatalogueReadModel;
}

/** The validated index fixture, after an optional edit of the raw copy. */
export function indexFixture(
  edit?: (index: CatalogueReadModel) => void,
): CatalogueReadModel {
  const raw = rawIndexFixture();
  edit?.(raw);
  return readCatalogueIndex(raw);
}

/** A fresh, mutable copy of every detail fixture. */
export function rawDetailFixtures(): DetailFixtures {
  return structuredClone(
    fixtureJson("entry-details-v4.json"),
  ) as DetailFixtures;
}

/** One validated detail fixture: a current path, or a removed snapshot id. */
export function detailFixture(request: DetailRequest): EntryDetailV4 {
  const fixtures = rawDetailFixtures();
  const detail =
    request.snapshotId === undefined
      ? fixtures.current[request.path]
      : fixtures.removed[request.snapshotId];
  if (!detail || detail.entry.path !== request.path)
    throw new Error(`Missing detail fixture ${detailKey(request)}`);
  return readEntryDetail(detail);
}

/**
 * Every validated detail fixture with its request, optionally only those of
 * the given entry paths.
 */
export function detailPairs(
  paths?: readonly string[],
  fixtures: DetailFixtures = rawDetailFixtures(),
): (readonly [DetailRequest, EntryDetailV4])[] {
  const pairs: (readonly [DetailRequest, EntryDetailV4])[] = [];
  for (const [path, detail] of Object.entries(fixtures.current))
    if (!paths || paths.includes(path))
      pairs.push([{ path }, readEntryDetail(detail)]);
  for (const [snapshotId, detail] of Object.entries(fixtures.removed))
    if (!paths || paths.includes(detail.entry.path))
      pairs.push([
        { path: detail.entry.path, snapshotId },
        readEntryDetail(detail),
      ]);
  return pairs;
}

/** Validated detail fixtures keyed as the shell holds them. */
export function heldDetails(
  paths?: readonly string[],
): ReadonlyMap<string, EntryDetailV4> {
  return new Map(
    detailPairs(paths).map(([request, detail]) => [detailKey(request), detail]),
  );
}

/** The working shell model of an index and its held details. */
export function shellModelFixture(
  index: CatalogueReadModel = indexFixture(),
  details: ReadonlyMap<string, EntryDetailV4> = heldDetails(),
): ShellCatalogueReadModel {
  return shellCatalogueModel(index, details);
}

/** The shell's display catalogue of an index and its held details. */
export function catalogueFixture(
  index: CatalogueReadModel = indexFixture(),
  details: ReadonlyMap<string, EntryDetailV4> = heldDetails(),
): Catalogue {
  return viewerCatalogue(shellModelFixture(index, details));
}
