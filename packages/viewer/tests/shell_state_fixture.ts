import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

export const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

export const catalogue = viewerCatalogue(model);

export const context = viewerContext(model, defaultSelection);
