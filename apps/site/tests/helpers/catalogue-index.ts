import type { CatalogueReadModel } from "@mokly/viewer";

/** The valid index emitted by the fallback-build double. */
export function catalogueIndex(): CatalogueReadModel {
  return {
    schemaVersion: 9,
    identity: { id: "1".repeat(64), title: "Mokly" },
    deploymentId: "2".repeat(64),
    revision: 0,
    changesStatus: "disabled",
    comparisonUrl: null,
    tree: [
      {
        kind: "folder",
        path: "product",
        title: "Product",
        children: [
          {
            kind: "folder",
            path: "product/account",
            title: "Account",
            children: [
              { kind: "entry", path: "product/account/project-created" },
            ],
          },
        ],
      },
    ],
    screens: [
      {
        kind: "screen",
        path: "product/account/project-created",
        title: "Project created",
        detailId: "3".repeat(64),
        tags: [],
        details: {
          description: "Created",
          sourcePath: "entries/created.mockup.tsx",
          relatedDocs: [],
        },
        changes: { status: "disabled" },
        useCasePaths: [],
        colorSchemes: ["light", "dark"],
        propSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        props: {},
        controls: {},
        views: (["mobile", "desktop"] as const).flatMap((viewport) =>
          (["light", "dark"] as const).map((colorScheme) => ({
            viewport,
            colorScheme,
            comparison: { status: "disabled" as const },
            documentKey: "4".repeat(64),
          })),
        ),
      },
    ],
    pages: [],
    documents: [],
    useCases: [],
    components: [],
    removedEntries: [],
  };
}
