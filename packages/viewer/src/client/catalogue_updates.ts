import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";

const snapshots = new WeakMap<Document, CatalogueReadModel>();
/** Accept evidence for this content only; private host transports stay outside the viewer. */
export function adoptCatalogueRevision(doc: Document, value: unknown): boolean {
  const catalogue = readCatalogue(value);
  const previous = snapshots.get(doc);
  const content = Number(
    doc.documentElement.getAttribute("data-mokly-content-version"),
  );
  if (
    catalogue.revision.content !== content ||
    (previous &&
      (previous.identity.id !== catalogue.identity.id ||
        previous.revision.evidence > catalogue.revision.evidence))
  )
    return false;
  snapshots.set(doc, catalogue);
  doc.dispatchEvent(
    new CustomEvent("mokly:catalogue-updated", { detail: catalogue }),
  );
  return true;
}
