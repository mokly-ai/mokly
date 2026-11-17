import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DOCS_SECTIONS } from "../../../docs/mockups/src/screens/design/site/parts/docs_data.js";
import { REFERENCE_DOCUMENTS } from "../src/docs/reference-allowlist.js";
import { moklyPackagePath } from "../src/mokly-package.js";

import { publishedProtocols } from "./helpers/published-protocols.js";

test("the docs mockup depicts the package's published Reference order", () => {
  const published = publishedProtocols(
    readFileSync(moklyPackagePath("docs/protocol/mokly-guides.md"), "utf8"),
  );
  const depicted = DOCS_SECTIONS.find(({ title }) => title === "Reference");
  assert.deepEqual(
    depicted?.pages,
    published.map(
      ({ source }) =>
        REFERENCE_DOCUMENTS.find((document) => document.source === source)
          ?.title,
    ),
  );
});
