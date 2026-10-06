import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRules } from "../packages/mokly/src/review/css/diff.js";
import { LightningCssRuleParser } from "../packages/mokly/src/review/css/rules.js";

const parser = new LightningCssRuleParser();

for (const [separated, joined] of [
  ['url/**/("a.svg")', 'url("a.svg")'],
  ["calc/**/(1px + 2px)", "calc(1px + 2px)"],
  ["var/**/(--tone)", "var(--tone)"],
  ["foo/**/bar", "foobar"],
  [String.raw`u\72l/**/("a.svg")`, String.raw`u\72l("a.svg")`],
] as const) {
  test(`CSS parser preserves the token boundary in ${separated}`, () => {
    const before = parser.parse(`.a { --value: ${separated}; }`);
    const after = parser.parse(`.a { --value: ${joined}; }`);
    assert.ok(before.status === "parsed" && after.status === "parsed");
    assert.notEqual(
      before.rules[0]?.declarations,
      after.rules[0]?.declarations,
    );
    const spaced = parser.parse(
      `.a { --value: ${separated.replace("/**/", " ")}; }`,
    );
    assert.deepEqual(before, spaced);
  });

  test(`CSS diff retains edits across the token boundary in ${separated}`, () => {
    const result = diffCssRules(
      `.a { --value: ${separated}; }`,
      `.a { --value: ${joined}; }`,
      parser,
    );
    assert.ok(result.status === "resolved");
    assert.equal(result.changed.length, 1);
  });
}

test("ordinary declaration function boundaries remain material", () => {
  const result = diffCssRules(
    '.a { background: url/**/("a.svg"); }',
    '.a { background: url("a.svg"); }',
    parser,
  );
  assert.ok(result.status === "resolved");
  assert.equal(result.changed.length, 1);
});
