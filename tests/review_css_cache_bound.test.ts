import assert from "node:assert/strict";
import test from "node:test";

import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import { CssRuleParseError } from "../src/review/css/types.js";

test("a zero-byte parse cache recomputes every request", () => {
  let calls = 0;
  const native = new LightningCssRuleParser();
  const analysis = new CssResourceAnalysis(
    {
      parse(source) {
        calls++;
        return native.parse(source);
      },
    },
    undefined,
    0,
  );
  const first = analysis.parser.parse(".a{color:red}");
  for (let request = 0; request < 3; request++)
    assert.deepEqual(analysis.parser.parse(".a{color:red}"), first);
  assert.equal(calls, 4);
});

test("opaque parse error payloads are returned without being cached", () => {
  let calls = 0;
  const error = new CssRuleParseError({ source: () => "opaque" });
  const analysis = new CssResourceAnalysis({
    parse() {
      calls++;
      return { status: "unresolved", error };
    },
  });
  for (let request = 0; request < 3; request++) {
    const result = analysis.parser.parse("bad");
    assert.equal(result.status, "unresolved");
    if (result.status === "unresolved") assert.equal(result.error, error);
  }
  assert.equal(calls, 3);
});
