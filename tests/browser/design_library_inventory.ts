import type { CatalogueReadModel } from "@mokly/viewer";

import {
  DUAL_SCHEME,
  SHARED_COMPONENTS,
} from "../helpers/design_expectations.js";

export const designLibrary = Object.entries(SHARED_COMPONENTS).map(
  ([id, variants]): readonly [string, string, readonly string[]] => {
    const separator = id.indexOf("/");
    return [id.slice(0, separator), id.slice(separator + 1), variants];
  },
);

type LibraryCase = Pick<
  CatalogueReadModel["components"][number],
  "kind" | "path" | "colorSchemes" | "variantOf"
>;

export const libraryCases = Object.entries(SHARED_COMPONENTS)
  .flatMap(([id, variants]) => {
    const path = `design/library/${id}`;
    const parent: LibraryCase = {
      kind: "component",
      path,
      colorSchemes: DUAL_SCHEME.test(path) ? ["light", "dark"] : ["light"],
    };
    return [
      parent,
      ...variants.map((variant) => ({
        ...parent,
        path: `${path}/${variant}`,
        variantOf: path,
      })),
    ];
  })
  .sort((a, b) => a.path.localeCompare(b.path));
