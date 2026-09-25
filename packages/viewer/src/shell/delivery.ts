/** Static-deployment continuity checks for read-model navigation. */

import { readCatalogue } from "../catalogue/reader.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import {
  parseStaticDelivery,
  type StaticDelivery,
} from "../navigation/delivery.js";

const staticAttribute = "data-mokly-static";
const deliveryAttribute = "data-mokly-delivery";

/** Read authenticated static metadata; malformed static roots fail closed. */
export function readShellDelivery(doc: Document): StaticDelivery | undefined {
  const mode = doc.documentElement.getAttribute(staticAttribute);
  const raw = doc.documentElement.getAttribute(deliveryAttribute);
  if (mode === null && raw === null) return undefined;
  if (mode === "" && raw !== null) {
    try {
      const value = parseStaticDelivery(JSON.parse(raw));
      if (value) return value;
    } catch {
      // The shared failure below keeps malformed and missing metadata alike.
    }
  }
  throw new Error(
    "The exported catalogue information is unavailable. Reload the page.",
  );
}

/** Verify that the deployed read model still belongs to the mounted shell. */
export async function currentDeploymentMatches(
  win: Window & typeof globalThis,
  catalogue: Pick<CatalogueReadModel, "deploymentId">,
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
