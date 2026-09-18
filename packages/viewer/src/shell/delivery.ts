/** Static-deployment continuity checks for read-model navigation. */

import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";

/** Verify that the deployed read model still belongs to the mounted shell. */
export async function currentDeploymentMatches(
  win: Window & typeof globalThis,
  catalogue: CatalogueReadModel,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const response = await win.fetch(
      new URL("/__mokly/catalogue.json", win.location.href),
      {
        cache: "no-store",
        credentials: "omit",
        signal,
      },
    );
    if (!response.ok) return false;
    return (
      readCatalogue(await response.json()).deploymentId ===
      catalogue.deploymentId
    );
  } catch {
    return false;
  }
}
