// Copies the shared Folio tokens to the example catalogue, which links them
// by relative path from its generated site mockups. The site imports the same
// file directly; this copy exists only because the example catalogue is a
// static output tree with no bundler. tests/design_site_tokens.test.ts fails
// when the copy no longer matches its source.
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const source = path.join(repositoryRoot, "design", "folio", "tokens.css");
const copy = path.join(
  repositoryRoot,
  "examples",
  "basic",
  "generated",
  "site-tokens.css",
);

await fs.promises.copyFile(source, copy);
