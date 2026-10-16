import type { CatalogueReadModel } from "@mokly/viewer";

import { test } from "./browser_test.js";

export type DesignEntry =
  | CatalogueReadModel["screens"][number]
  | CatalogueReadModel["components"][number];
export const designEntries: DesignEntry[] = [];
test.beforeAll(async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  if (!response.ok())
    throw new Error(`Catalogue index: HTTP ${response.status()}`);
  const index = (await response.json()) as CatalogueReadModel;
  designEntries.splice(
    0,
    designEntries.length,
    ...index.screens,
    ...index.components,
  );
  if (!designEntries.length) throw new Error("Empty design inventory");
});
