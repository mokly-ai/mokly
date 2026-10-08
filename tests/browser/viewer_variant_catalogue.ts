import type { CatalogueNode, CatalogueReadModel } from "@mokly/viewer";
import type {} from "./viewer_harness.js";

function appendScreenVariant(
  node: CatalogueNode,
  parentId: string,
  variantPath: string,
): CatalogueNode {
  if (node.kind === "entry" && node.path === parentId)
    return {
      ...node,
      children: [
        ...(node.children ?? []),
        { kind: "entry", path: variantPath },
      ],
    };
  return node.children
    ? {
        ...node,
        children: node.children.map((child) =>
          appendScreenVariant(child, parentId, variantPath),
        ),
      }
    : node;
}

export function screenVariantCatalogue(
  catalogue: CatalogueReadModel,
): CatalogueReadModel {
  const source = structuredClone(catalogue);
  const unmodified = {
    status: "ready" as const,
    kind: "unmodified" as const,
    included: false,
  };
  const model: CatalogueReadModel = {
    ...source,
    screens: source.screens.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    pages: source.pages.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    useCases: source.useCases.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    components: source.components.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
  };
  const parentIndex = model.screens.findIndex(({ path }) => path === "home");
  const parent = model.screens[parentIndex];
  if (!parent) throw new Error("Missing viewer screen fixture");
  const variant = {
    ...parent,
    path: "home/error",
    title: "Save failed",
    variantOf: parent.path,
    changes: {
      status: "ready" as const,
      kind: "changed" as const,
      included: true,
    },
    views: parent.views.map((view) => ({
      ...view,
      comparison:
        view.viewport === "mobile" && view.colorScheme === "dark"
          ? {
              status: "ready" as const,
              kind: "changed" as const,
              eligible: true,
            }
          : {
              status: "ready" as const,
              kind: "unmodified" as const,
              eligible: false,
            },
    })),
  };
  return {
    ...model,
    changesStatus: "ready",
    screens: [
      ...model.screens.slice(0, parentIndex),
      { ...parent, changes: unmodified },
      variant,
      ...model.screens.slice(parentIndex + 1),
    ],
    tree: model.tree.map((node) =>
      appendScreenVariant(node, parent.path, variant.path),
    ),
  };
}
