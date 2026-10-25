import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import inventory from "../fixtures/design-library/browser-inventory.json" with { type: "json" };

import { test } from "./browser_test.js";

export type DesignEntry =
  | CatalogueReadModel["screens"][number]
  | CatalogueReadModel["components"][number];
/** Fixed discovery inputs; runtime validation prevents an untested new design. */
export const designCases = inventory as Array<{
  kind: "screen" | "component";
  path: string;
  colorSchemes: ("light" | "dark")[];
  variantOf?: string;
}>;

/** Each spec registers its own catalogue read and owns its mutable entry list. */
export function designCatalogue(fixtureTest = test): DesignEntry[] {
  const entries: DesignEntry[] = [];
  fixtureTest.beforeAll(async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
    if (!response.ok())
      throw new Error(`Catalogue index: HTTP ${response.status()}`);
    const index = (await response.json()) as CatalogueReadModel;
    entries.push(...index.screens, ...index.components);
    const actual = entries
      .filter((entry) => entry.path.startsWith("design/"))
      .map((entry) => ({
        kind: entry.kind,
        path: entry.path,
        colorSchemes: entry.colorSchemes,
        ...("variantOf" in entry && entry.variantOf
          ? { variantOf: entry.variantOf }
          : {}),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    expect(actual).toEqual(
      [...designCases].sort((a, b) => a.path.localeCompare(b.path)),
    );
  });
  return entries;
}
