import { createHash } from "node:crypto";

import type { CatalogueReadModel } from "@mokly/viewer";
import { canonicalJson, repositoryPath } from "@mokly/viewer/data";

export const CATALOGUE_PATH = "__mokly/catalogue.json";
export const ZERO_DEPLOYMENT_ID = "0".repeat(64);

/** Stable catalogue identity does not depend on checkout or output location. */
export function catalogueIdentity(
  configPath: string,
): CatalogueReadModel["identity"] {
  repositoryPath(configPath);
  return {
    id: createHash("sha256")
      .update(JSON.stringify(["mokly-catalogue-v1", configPath]))
      .digest("hex"),
    title: "Mokly",
  };
}

export function serializeCatalogue(model: CatalogueReadModel): string {
  return `${canonicalJson(model, 2)}\n`;
}

/** Serve identifies its canonical public snapshot, including its revisions. */
export function identifyLiveCatalogue(model: CatalogueReadModel): string {
  return createHash("sha256")
    .update(serializeCatalogue({ ...model, deploymentId: ZERO_DEPLOYMENT_ID }))
    .digest("hex");
}
