import type { CatalogueReadModel } from "../../packages/viewer/dist/catalogue/types.js";
import { searchRow } from "../../packages/viewer/dist/shell/search_query.js";

import { catalogueModel } from "./viewer_catalogue.js";

export const noTitles = (): readonly string[] => [];

/** A search row outside every folder. */
export const row = (path: string, title: string, tags: readonly string[]) =>
  searchRow({ path, tags, title }, []);

export const welcome = row("welcome", "Welcome", ["forms", "onboarding"]);

export const details = row("product/browse/details", "Details", ["forms"]);

export const glossary = row("glossary", "Glossary", []);

export const transferReady = row(
  "transactions-list-transfer-ready",
  "Ready to transfer",
  ["operations"],
);

export function selectionModel(detailsChanged: boolean): CatalogueReadModel {
  const model = catalogueModel();
  const template = model.screens[0]!;
  const changes = (included: boolean) => ({
    included,
    kind: included ? ("changed" as const) : ("unmodified" as const),
    status: "ready" as const,
  });
  return {
    ...model,
    screens: [
      {
        ...template,
        changes: changes(false),
        path: "welcome",
        tags: welcome.tags,
        title: welcome.title,
      },
      {
        ...template,
        changes: changes(detailsChanged),
        path: "product/browse/details",
        tags: details.tags,
        title: details.title,
      },
    ],
  };
}
