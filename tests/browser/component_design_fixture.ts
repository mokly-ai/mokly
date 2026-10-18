import path from "node:path";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designCases, designCatalogue } from "./design_catalogue.js";
import { designFileUrl } from "./design_fixture.js";

/** Register independent hooks for every spec and reject an unknown design route. */
export function componentDesignFixture(
  fixtureTest = test,
  documentUrl = designFileUrl,
) {
  const entries = designCatalogue(fixtureTest);
  const componentDesignRoutes = designCases
    .filter(
      (entry) =>
        entry.kind === "screen" && entry.path.startsWith("design/components/"),
    )
    .map((entry) => entry.path);
  return {
    componentDesignRoutes,
    componentDesignUrl(entryPath: string, viewport: string): string {
      if (
        !componentDesignRoutes.includes(entryPath) ||
        !entries.some((entry) => entry.path === entryPath)
      )
        throw new Error(`Unknown component design: ${entryPath}`);
      return documentUrl(
        path.join(
          repositoryRoot,
          "examples/basic/mokly-generated",
          entryPath,
          `index.${viewport}.html`,
        ),
      ).href;
    },
  };
}
