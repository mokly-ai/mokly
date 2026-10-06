import assert from "node:assert/strict";
import test from "node:test";

import { decodeCssEscapes } from "../dist/review/css/escape_decoding.js";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  captureStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const prefixes = [
  "#url",
  "@url",
  String.raw`#\75rl`,
  String.raw`@\75rl`,
  "\0url",
];
for (const prefix of prefixes)
  test(`only standalone url enters URL state: ${JSON.stringify(prefix)}`, () => {
    assert.equal(
      decodeCssEscapes(`${prefix}(#x "a\\\nb")`),
      `${prefix.replace(String.raw`\75`, "u")}(#x "ab")`,
    );
  });

test("escaped sigils are identifier characters and NUL stays an identifier character", () => {
  for (const prefix of [
    String.raw`\23 url`,
    String.raw`\40 url`,
    String.raw`\0 url`,
  ])
    assert.ok(decodeCssEscapes(`${prefix}(#x "a\\\nb")`).endsWith('(#x "ab")'));
});

for (const mode of ["committed", "derived"] as const)
  test(`hash/at/NUL URL contexts preserve the full view outcome in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const prefix of prefixes)
      for (const identical of [true, false])
        await context.test(
          `${JSON.stringify(prefix)}, identical=${identical}`,
          async (context) => {
            const css = `.entry:foo(${prefix}(#x "<!--mok\\\nly-review-material:clock:${"a".repeat(64)}-->")){background:url("../asset.svg")}`;
            const ignored = (text: string) =>
              identical
                ? ""
                : `<!--mokly-review-ignore:start:other-->${text}<!--mokly-review-ignore:end:other-->`;
            const input = withHeadStyles(
              base,
              `<style>${css}</style>${ignored("before")}`,
              `<style>${css}</style>${ignored("after")}`,
              mode,
            );
            const fixture = {
              ...input,
              beforeFiles: new Map([
                ...input.beforeFiles,
                ["asset.svg", "same"],
              ]),
              afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
            };
            const oracle = await captureStyleSwitches(
              fixture,
              styleSwitches[0],
            );
            if (prefix === "#url")
              assert.deepEqual(oracle, {
                kind: "error",
                name: "Error",
                message:
                  "[mokly/review-ignore] home/index.mobile.html: material signal for clock has no region",
              });
            for (const switches of styleSwitches)
              await context.test(JSON.stringify(switches), async () => {
                const actual = await captureStyleSwitches(fixture, switches);
                assert.deepEqual(actual, oracle);
                if (actual.kind === "result")
                  assert.equal(actual.comparisonPath, "complete");
              });
          },
        );
  });

test("standalone URL names after delimiters retain unquoted URL context", () => {
  for (const prefix of ["# ", "@ ", "#/**/", "@/**/"])
    assert.equal(
      decodeCssEscapes(`${prefix}url(foo/*bar) "a\\\nb"`),
      `${prefix}url(foo/*bar) "ab"`,
    );
});
