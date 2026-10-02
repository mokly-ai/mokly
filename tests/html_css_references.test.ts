import assert from "node:assert/strict";
import test from "node:test";

import { extractCssReferences } from "../dist/css_references.js";
import { extractHtmlReferences } from "../dist/html_references.js";

import { cssReferenceInputs } from "./helpers/html_reference_inputs.js";

for (const [source, expected] of cssReferenceInputs)
  test(`CSS references preserve tokenizer boundaries: ${source}`, () => {
    assert.deepEqual(extractCssReferences(source), expected);
    assert.deepEqual(
      extractHtmlReferences(`<style>${source}</style>`).resources,
      expected,
    );
  });
