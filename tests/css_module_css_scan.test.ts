import assert from "node:assert/strict";
import test from "node:test";

import {
  cssWhitespaceAt,
  scanCssText,
} from "../dist/build/styles/module_css_scan.js";
import { scanScopePrelude } from "../dist/build/styles/module_scope.js";

for (const whitespace of [" ", "\t", "\n", "\r", "\f", "\r\n"])
  test(`CSS scanner recognizes ${JSON.stringify(whitespace)}`, () => {
    const text = `.a${whitespace}.b`;
    const scan = scanCssText(text);
    const index = text.indexOf(whitespace);
    assert.equal(cssWhitespaceAt(scan, index), true);
    if (whitespace === "\r\n")
      assert.equal(cssWhitespaceAt(scan, index + 1), true);
  });

for (const digits of ["1", "31", "031", "0031", "00031", "000031"])
  for (const whitespace of [" ", "\t", "\n", "\r", "\f", "\r\n"])
    test(`${digits.length}-digit CSS escape consumes ${JSON.stringify(whitespace)}`, () => {
      const text = `.a\\${digits}${whitespace}.b`;
      const scan = scanCssText(text);
      const index = text.indexOf(whitespace);
      assert.equal(cssWhitespaceAt(scan, index), false);
      assert.equal(scan.hexEscapes.length, 1);
      assert.equal(scan.hexEscapes[0]?.digits, digits.length);
      assert.equal(scan.hexEscapes[0]?.terminatorStart, index);
      assert.equal(scan.hexEscapes[0]?.end, index + whitespace.length);
    });

test("non-CSS Unicode spaces stay name characters", () => {
  for (const space of ["\u00a0", "\u2003", "\u202f"]) {
    const text = `.a${space}.b`;
    assert.equal(cssWhitespaceAt(scanCssText(text), 2), false);
  }
});

test("escaped backslashes do not begin hex escapes", () => {
  const text = String.raw`.a\\31 .b`;
  const scan = scanCssText(text);
  assert.equal(scan.hexEscapes.length, 0);
  assert.equal(cssWhitespaceAt(scan, text.indexOf(" ")), true);
});

test("strings and comments hide escape and whitespace syntax", () => {
  const text = String.raw`"a\31  b" 'c\31  d' /* a /* b */ .x`;
  const scan = scanCssText(text);
  assert.equal(scan.hexEscapes.length, 0);
  assert.equal(cssWhitespaceAt(scan, text.indexOf("  ")), false);
  assert.equal(scan.comments.length, 1);
  assert.equal(scan.comments[0]?.end, text.indexOf("*/") + 2);
  assert.equal(cssWhitespaceAt(scan, text.indexOf(" .x")), true);
});

test("escaped quotes do not terminate either kind of CSS string", () => {
  for (const text of [String.raw`[x="a\"b"] .y`, String.raw`[x='a\'b'] .y`]) {
    const scan = scanCssText(text);
    assert.equal(scan.hexEscapes.length, 0);
    assert.equal(cssWhitespaceAt(scan, text.indexOf(" .y")), true);
  }
});

test("a real no-break space after a hex escape is not whitespace", () => {
  const text = `.a\\31\u00a0.b`;
  const scan = scanCssText(text);
  assert.equal(cssWhitespaceAt(scan, text.indexOf("\u00a0")), false);
  assert.equal(scan.hexEscapes[0]?.end, text.indexOf("\u00a0"));
});

test("a non-hex escape does not consume following whitespace", () => {
  const text = String.raw`.a\z .b`;
  const scan = scanCssText(text);
  assert.equal(scan.hexEscapes.length, 0);
  assert.equal(cssWhitespaceAt(scan, text.indexOf(" ")), true);
});

test("scope preludes use CSS whitespace rather than Unicode spacing", () => {
  assert.ok(scanScopePrelude("(.a)TO\f(.b)").limit);
  assert.ok(scanScopePrelude("(\u00a0)").start);
  assert.throws(() => scanScopePrelude("(.a)\u00a0to(.b)"));
});
