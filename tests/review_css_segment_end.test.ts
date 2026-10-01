import assert from "node:assert/strict";
import test from "node:test";

import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

import { parseSnapshot } from "./helpers/css_segments.js";
import { parseInlineRuleList } from "./helpers/inline_parse.js";

for (const prefix of ["#", "@", "\0"])
  for (const bound of [undefined, 0])
    for (const split of [false, true])
      test(`opaque-looking ${JSON.stringify(prefix)}url comment equals whole parsing, bound ${bound}, split ${split}`, () => {
        const text = `.x{--y:${prefix}url(/*)}`;
        const sources = split ? [text, `${text} ${text}`] : [`${text} ${text}`];
        const spans = sources.map((source) => ({
          start: 0,
          end: source.length + 15,
          source: `<style>${source}</style>`,
          text: source,
        }));
        const native = new LightningCssRuleParser();
        const actual = parseInlineRuleList(
          spans,
          new CssResourceAnalysis(native, undefined, bound).parser,
        );
        const expected = parseInlineRuleList(spans, {
          parse: (source) => native.parse(source),
        });
        assert.equal(expected.status, "unresolved");
        assert.deepEqual(parseSnapshot(actual), parseSnapshot(expected));
      });

for (const source of [
  ".x{--y:#url(/*)}",
  ".x{--y:@url(/*)}",
  ".x{--y:\0url(/*)}",
  "@foo #url(/*);",
])
  test(`native batch must prove its final terminator: ${JSON.stringify(source)}`, () => {
    assert.equal(
      new LightningCssRuleParser().parseSegments([source]),
      undefined,
    );
  });
