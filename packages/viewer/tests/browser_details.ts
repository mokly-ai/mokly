import type {
  CatalogueReadModel,
  EntryDetailV3,
} from "../src/catalogue/types.js";

/** Keep a test-owned index edit coherent with the fixture's separate details. */
export function browserDetails(
  index: CatalogueReadModel,
  held: Record<string, EntryDetailV3>,
): Record<string, EntryDetailV3> {
  const details = { ...held };
  const entries = [
    ...index.screens,
    ...index.components,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
  ];
  for (const entry of entries) {
    let detail = details[entry.path];
    if (!detail && entry.kind === "use-case")
      detail = {
        schemaVersion: 3,
        identity: index.identity,
        detailId: entry.detailId,
        entry: { kind: "use-case", path: entry.path },
        views: [],
      };
    if (!detail)
      throw new Error(`Missing browser fixture detail: ${entry.path}`);
    const views =
      "views" in entry
        ? entry.views.map((view) => {
            const held = detail.views.find(
              (candidate) =>
                candidate.viewport === view.viewport &&
                candidate.colorScheme === view.colorScheme,
            );
            if (!held)
              throw new Error(
                `Missing browser fixture view: ${entry.path}/${view.viewport}/${view.colorScheme}`,
              );
            return held;
          })
        : [];
    details[entry.path] = {
      ...detail,
      views,
      detailId: entry.detailId,
      revision: index.revision,
    };
  }
  return details;
}
