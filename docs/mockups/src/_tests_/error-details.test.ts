import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";
import { createElement } from "react";

import { ErrorReference } from "../components/error-reference";
import { StateMessage } from "../screens/product/page-parts";
import { attribute, elements, label } from "./design-site-test-helpers";
import { wrapperMarkup } from "./wrapper-markup";

const context = { viewport: "desktop", colorScheme: "light" } as const;

function drawing(reference?: string, details?: string) {
  return parse(
    wrapperMarkup(
      createElement(StateMessage, {
        title: "Failed to open",
        error: true,
        reference,
        details,
      }),
      context,
    ),
  );
}

test("a state combines reference and viewer diagnostics in one closed Details disclosure", () => {
  const document = drawing(
    "fixture-reference",
    "Unsupported catalogue version 4",
  );
  const disclosures = elements(
    document,
    (element) => element.tagName === "details",
  );
  assert.equal(disclosures.length, 1);
  assert.equal(attribute(disclosures[0], "open"), undefined);
  assert.ok(label(disclosures[0]).includes("Reference fixture-reference"));
  assert.ok(label(disclosures[0]).includes("Unsupported catalogue version 4"));
  assert.equal(
    elements(document, (element) => element.tagName === "summary").length,
    1,
  );
});

test("details without a reference show plain escaped text and absent diagnostics show no disclosure", () => {
  const document = drawing(undefined, "<script>Fixture</script>");
  const disclosures = elements(
    document,
    (element) => element.tagName === "details",
  );
  assert.equal(disclosures.length, 1);
  assert.ok(label(disclosures[0]).includes("<script>Fixture</script>"));
  assert.ok(!label(disclosures[0]).includes("Reference"));
  assert.equal(
    elements(document, (element) => element.tagName === "script").length,
    0,
  );
  assert.equal(
    elements(drawing(), (element) => element.tagName === "details").length,
    0,
  );
  const reference = parse(
    wrapperMarkup(
      createElement(ErrorReference, { reference: "fixture-reference" }),
      context,
    ),
  );
  assert.equal(
    elements(reference, (element) => element.tagName === "details").length,
    1,
  );
});
