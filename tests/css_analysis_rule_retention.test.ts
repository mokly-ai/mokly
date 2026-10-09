import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { parse } from "parse5";

import { MoklyError } from "../dist/errors.js";
import { analyzeStylesheetChange } from "../dist/review/css/analyze.js";
import { CssRuleIdentities } from "../dist/review/css/identity.js";

test("standalone CSS analysis retains rule deltas and all element matches", () => {
  const outcome = analyzeStylesheetChange(".a{color:red}", ".a{color:blue}", {
    after: parse('<b class="a">One</b><i class="a">Two</i>'),
  });
  assert.ok(outcome.kind === "kept");
  assert.equal(outcome.rules.length, 1);
  assert.equal(outcome.rules[0]!.matches.length, 2);
  assert.equal(outcome.rules[0]!.change.before?.declarations, "color:red");
});

test("a surviving diff keeps each rule when an injected matcher fails", () => {
  const outcome = analyzeStylesheetChange(
    "",
    ".a{color:red}.b{color:blue}",
    {},
    undefined,
    () => {
      throw new Error("matcher failure");
    },
  );
  assert.ok(outcome.kind === "kept");
  assert.equal(outcome.status, "unresolved");
  assert.equal(outcome.rules.length, 2);
  assert.ok(
    outcome.rules.every(
      (rule) =>
        rule.outcome.kind === "kept" && rule.outcome.status === "unresolved",
    ),
  );
});

test("CSS identity uses the exact normalized side tuples without conditions or ordinals", () => {
  const rule = {
    ordinal: 0,
    selectors: [".b", ".a"],
    declarations: "color:red;color:blue!important;",
    conditions: [],
    hasCustomProperties: false,
  };
  const change = { kind: "added" as const, after: rule };
  const expected = createHash("sha256")
    .update(
      JSON.stringify([
        "mokly-css-change-v1",
        null,
        [rule.selectors, rule.declarations],
      ]),
    )
    .digest("hex");
  const identities = new CssRuleIdentities();
  assert.equal(identities.key(change), expected);
  assert.equal(
    identities.key({
      ...change,
      after: {
        ...rule,
        ordinal: 10,
        conditions: [{ kind: "media", prelude: "(width > 100px)" }],
      },
    }),
    expected,
  );
  assert.notEqual(
    identities.key({ ...change, after: { ...rule, selectors: [".a", ".b"] } }),
    expected,
  );
  assert.notEqual(identities.key({ kind: "removed", before: rule }), expected);
  assert.notEqual(
    identities.key({
      kind: "changed",
      before: { ...rule, declarations: "" },
      after: rule,
    }),
    expected,
  );
});

test("CSS tuple collisions fail review-invalid instead of combining different changes", () => {
  const identities = new CssRuleIdentities(() => "a".repeat(64));
  const rule = {
    ordinal: 0,
    selectors: [".a"],
    declarations: "color:red;",
    conditions: [],
    hasCustomProperties: false,
  };
  identities.key({ kind: "added", after: rule });
  assert.throws(
    () =>
      identities.key({
        kind: "added",
        after: { ...rule, declarations: "color:blue;" },
      }),
    (error) => error instanceof MoklyError && error.code === "review-invalid",
  );
});
