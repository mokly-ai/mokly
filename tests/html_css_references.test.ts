import assert from "node:assert/strict";
import test from "node:test";

import { extractCssReferences } from "../dist/css_references.js";
import {
  extractHtmlReferences,
  resolveLocalReferencePath,
} from "../dist/html_references.js";

import { cssReferenceInputs } from "./helpers/html_reference_inputs.js";

for (const [source, expected] of cssReferenceInputs)
  test(`CSS references preserve tokenizer boundaries: ${source}`, () => {
    assert.deepEqual(extractCssReferences(source), expected);
    assert.deepEqual(
      extractHtmlReferences(`<style>${source}</style>`).resources,
      expected,
    );
  });

test("local references resolve from the generated document's actual directory", () => {
  assert.deepEqual(
    resolveLocalReferencePath(
      "mokly-generated/home/index.mobile.html",
      "../../styles.css?theme=dark#header",
    ),
    { kind: "resolved", path: "styles.css" },
  );
  assert.deepEqual(
    resolveLocalReferencePath(
      "mokly-generated/home/index.html",
      "../../../secret.css",
    ),
    { kind: "escape" },
  );
  assert.deepEqual(
    resolveLocalReferencePath("mokly-generated/home.html", "%2Fprivate.css"),
    { kind: "root-absolute" },
  );
  assert.deepEqual(resolveLocalReferencePath("index.html", "/", true), {
    kind: "resolved",
    path: "index.html",
  });
  assert.deepEqual(resolveLocalReferencePath("index.html", "%ZZ"), {
    kind: "invalid-encoding",
  });
});
