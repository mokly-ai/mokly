import { invalidData } from "../components/data.js";

import type { ShellCatalogueRoutedEntry } from "./scoped_types.js";
import type { CatalogueNode } from "./types.js";

/** Validate public tree references without rebuilding private folder metadata. */
export function validateCatalogueTree(
  tree: readonly CatalogueNode<string>[],
  entries: readonly ShellCatalogueRoutedEntry<string>[],
): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  const folders = new Set<string>();
  const fail = (message: string): never => invalidData("$catalogue", message);
  const visit = (
    nodes: readonly CatalogueNode<string>[],
    parent?: CatalogueNode<string>,
  ): void => {
    for (const node of nodes) {
      const entry = node.kind === "entry" ? byPath.get(node.path) : undefined;
      if (!parent && node.path.includes("/"))
        fail("tree root is missing its parent folder");
      if (parent) {
        const index = parent.kind === "folder" && parent.index === node.path;
        const variant =
          parent.kind === "entry" &&
          entry &&
          "variantOf" in entry &&
          entry.variantOf === parent.path;
        if (
          !index &&
          !variant &&
          node.path.split("/").slice(0, -1).join("/") !== parent.path
        )
          fail("tree child must be below its parent path");
      }
      if (node.kind === "folder") {
        if (folders.has(node.path.toLowerCase())) fail("duplicate tree folder");
        folders.add(node.path.toLowerCase());
        if (!node.children.length) fail("tree folder cannot be empty");
        if (node.index !== undefined) {
          const index = byPath.get(node.index);
          if (
            node.index !== node.path ||
            !index ||
            !["page", "document", "use-case"].includes(index.kind) ||
            node.children[0]?.kind !== "entry" ||
            node.children[0].path !== node.index
          )
            fail("folder index must be its first child page");
        }
      } else {
        if (!entry || seen.has(node.path))
          fail("tree entry must name one unique current entry");
        seen.add(node.path);
        if (
          entry &&
          "variantOf" in entry &&
          entry.variantOf !== undefined &&
          node.children !== undefined
        )
          fail("variant cannot have children");
        const variants = entries.filter(
          (candidate) =>
            "variantOf" in candidate && candidate.variantOf === node.path,
        );
        if (
          node.children !== undefined &&
          (!node.children.length ||
            (entry && entry.kind !== "screen" && entry.kind !== "component"))
        )
          fail("only grouped screen and component entries have children");
        if (
          variants.some(
            (variant, index) => node.children?.[index]?.path !== variant.path,
          )
        )
          fail("tree variants must retain authored order");
        if (
          entry &&
          "variantOf" in entry &&
          entry.variantOf !== undefined &&
          (parent?.kind !== "entry" || parent.path !== entry.variantOf)
        )
          fail("variant must be below its parent entry");
      }
      if (node.children) visit(node.children, node);
    }
  };
  visit(tree);
  if (seen.size !== entries.length)
    fail("tree must contain every current entry");
}
