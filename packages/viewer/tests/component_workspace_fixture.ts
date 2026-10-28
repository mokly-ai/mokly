import { isManifestComponentVariant } from "../src/components/manifest_types.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import { shellModelFixture } from "./catalogue_v8_fixture.js";

export function componentWorkspaceFixture() {
  const model = shellModelFixture();

  const catalogue = viewerCatalogue(model);

  const source = catalogue.byPath.get("components/action");

  if (source?.kind !== "component" || isManifestComponentVariant(source))
    throw new Error("Missing component fixture");

  const sourceVariant = catalogue.hierarchy.variantsByPath.get(
    source.path,
  )?.[0];

  if (
    sourceVariant?.kind !== "component" ||
    !isManifestComponentVariant(sourceVariant)
  )
    throw new Error("Missing component variant fixture");
  return { model, catalogue, source, sourceVariant };
}
