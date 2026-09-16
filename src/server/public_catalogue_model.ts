import { readCatalogue } from "@mokly/viewer";
import type { CatalogueReadModel } from "@mokly/viewer";

import type { PublicCatalogueSource } from "./public_catalogue.js";

const snapshots = new WeakMap<
  PublicCatalogueSource,
  { bytes: string; model: CatalogueReadModel }
>();

/** A serialized public revision is immutable; validate once before sharing it across shell requests. */
export function readPublicCatalogue(
  source: PublicCatalogueSource,
): CatalogueReadModel {
  const bytes = source.read();
  const previous = snapshots.get(source);
  if (previous?.bytes === bytes) return previous.model;
  const model = readCatalogue(JSON.parse(bytes));
  snapshots.set(source, { bytes, model });
  return model;
}
