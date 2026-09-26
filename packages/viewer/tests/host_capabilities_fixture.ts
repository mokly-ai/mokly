import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";

export const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
export const generation = "a".repeat(32);
export const token = "b".repeat(64);
export const source = {
  base: "origin/main",
  catalogueId: catalogue.identity.id,
  contentRevision: catalogue.revision.content,
  evidenceRevision: catalogue.revision.evidence,
  previewGeneration: generation,
  renderGeneration: generation,
  updateVersion: 4,
};
