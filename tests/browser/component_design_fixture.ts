import path from "node:path";

import { repositoryRoot } from "../helpers/fixture.js";

import { designCases, designCatalogue } from "./design_catalogue.js";
import { designFileUrl } from "./design_fixture.js";

/**
 * Register independent hooks for every spec, and reject a design entry that
 * the frozen inventory or the delivery under test does not hold.
 */
export function designDocumentFixture() {
  const entries = designCatalogue();
  return {
    /** The document of a design entry in one viewport, in the delivery. */
    designDocumentUrl(entryPath: string, viewport: string): string {
      if (
        !designCases.some((entry) => entry.path === entryPath) ||
        !entries.some((entry) => entry.path === entryPath)
      )
        throw new Error(`Unknown design entry: ${entryPath}`);
      return designFileUrl(
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
