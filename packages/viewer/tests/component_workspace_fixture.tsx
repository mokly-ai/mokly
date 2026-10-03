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

export const source = componentSource();

function componentSource() {
  const selected = catalogue.byId.get("action");
  if (selected?.kind !== "component" || isManifestComponentVariant(selected))
    throw new Error("Missing component fixture");
  return selected;
}

export const sourceVariant = variantSource();

function variantSource() {
  const selected = catalogue.hierarchy.variantsById.get(source.id)?.[0];
  if (selected?.kind !== "component" || !isManifestComponentVariant(selected))
    throw new Error("Missing component variant fixture");
  return selected;
}
