import { isComponentVariant } from "../src/catalogue/variants.js";
import { createCatalogue } from "../src/shell/catalogue.js";

import { shellModelFixture } from "./catalogue_v9_fixture.js";

export function componentWorkspaceFixture() {
  const model = shellModelFixture();

  const catalogue = createCatalogue(model);

  const source = catalogue.byPath.get("components/action");

  if (source?.kind !== "component" || isComponentVariant(source))
    throw new Error("Missing component fixture");

  const sourceVariant = catalogue.hierarchy.variantsByPath.get(
    source.path,
  )?.[0];

  if (sourceVariant?.kind !== "component" || !isComponentVariant(sourceVariant))
    throw new Error("Missing component variant fixture");
  return { model, catalogue, source, sourceVariant };
}
