import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { MoklyError } from "../src/errors.js";
import { CssRuleIdentities } from "../src/review/css/identity.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";

import {
  compareMergedPage,
  mergedPage,
} from "./helpers/merged_page_fixture.js";

test("byte-only nested declared CSS changes no consumer material", async () => {
  const page = mergedPage("sheet.css");
  for (const useFastPath of [false, true]) {
    const result = await compareMergedPage(
      page,
      page,
      {
        before: { "sheet.css": ".action{color:red}" },
        after: { "sheet.css": ".action{color:blue}" },
      },
      [],
      { useFastPath, useStylePath: false },
    );
    assert.deepEqual(result.reasons, []);
    assert.equal(result.view.state, "changed");
    assert.equal(result.view.material, undefined);
  }
});

test("CSS identity collisions propagate through resource analysis", (t) => {
  const forced = new CssRuleIdentities(() => "same-key");
  const key = forced.key.bind(forced);
  t.mock.method(CssRuleIdentities.prototype, "key", key);
  const document = parse('<p class="a b">Page</p>', {
    sourceCodeLocationInfo: true,
  });
  assert.throws(
    () =>
      new CssResourceAnalysis().analyze(
        [
          { path: "a.css", before: ".a{color:red}", after: ".a{color:blue}" },
          { path: "b.css", before: ".b{color:red}", after: ".b{color:green}" },
        ],
        [{ before: document, after: document }],
      ),
    (error) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "review-invalid");
      assert.match(error.message, /CSS rule identity collision/);
      return true;
    },
  );
});
