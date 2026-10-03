import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import { isManifestComponentVariant } from "../src/components/manifest_types.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

export const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

export const catalogue = viewerCatalogue(model);

export const source = (() => {
  const entry = catalogue.byId.get("action");
  if (entry?.kind !== "component" || isManifestComponentVariant(entry))
    throw new Error("Missing component fixture");
  return entry;
})();

export const sourceVariant = (() => {
  const entry = catalogue.hierarchy.variantsById.get(source.id)?.[0];
  if (entry?.kind !== "component" || !isManifestComponentVariant(entry))
    throw new Error("Missing component variant fixture");
  return entry;
})();
