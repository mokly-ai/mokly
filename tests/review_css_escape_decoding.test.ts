import assert from "node:assert/strict";
import test from "node:test";

import { decodeCssEscapes } from "../dist/review/css/escape_decoding.js";

for (let length = 1; length <= 6; length++)
  test(`CSS escape decoding accepts ${length} hex digits`, () => {
    assert.equal(decodeCssEscapes(`\\${"a".padStart(length, "0")}x`), "\nx");
  });

test("hex escapes consume one whitespace terminator, treating CRLF as one", () => {
  for (const whitespace of [" ", "\t", "\n", "\r", "\r\n", "\f"])
    assert.equal(decodeCssEscapes(`\\3C${whitespace}!`), "<!");
  assert.equal(decodeCssEscapes(String.raw`\00003c !`), "<!");
  assert.equal(decodeCssEscapes(String.raw`\00003c  !`), "< !");
  assert.equal(decodeCssEscapes(String.raw`\00003c1`), "<1");
  assert.equal(decodeCssEscapes("\\3c\u00a0!"), "<\u00a0!");
});

test("non-hex escapes preserve escaped punctuation and astral characters", () => {
  assert.equal(
    decodeCssEscapes(String.raw`.md\:flex .w-1\/2 .hover\:bg-red:hover`),
    ".md:flex .w-1/2 .hover:bg-red:hover",
  );
  assert.equal(decodeCssEscapes(String.raw`\<\!\-\-mokly\-`), "<!--mokly-");
  assert.equal(decodeCssEscapes("\\💡"), "💡");
  assert.equal(decodeCssEscapes("\\"), "\ufffd");
});

test("escaped invalid code points become replacement characters", () => {
  for (const value of ["0", "000000", "d800", "DFFF", "110000", "ffffff"])
    assert.equal(decodeCssEscapes(`\\${value}!`), "\ufffd!");
  assert.equal(decodeCssEscapes("\\\0"), "\ufffd");
  assert.equal(decodeCssEscapes("\\\ud800"), "\ufffd");
  assert.equal(decodeCssEscapes("\\\udfff"), "\ufffd");
  assert.equal(
    decodeCssEscapes(String.raw`\10ffff`),
    String.fromCodePoint(0x10ffff),
  );
});

test("line continuations disappear only inside source strings", () => {
  for (const quote of ['"', "'"])
    for (const newline of ["\n", "\r", "\r\n", "\f"])
      assert.equal(
        decodeCssEscapes(`${quote}a\\${newline}b${quote}`),
        `${quote}ab${quote}`,
      );
  assert.equal(decodeCssEscapes("a\\\nb"), "a\nb");
  assert.equal(decodeCssEscapes("a\\\r\nb"), "a\r\nb");
  assert.equal(decodeCssEscapes('"a\\"\\\nb"'), '"a"b"');
  assert.equal(decodeCssEscapes('"a\\22 \\\nb"'), '"a"b"');
  assert.equal(decodeCssEscapes("\\22 a\\\nb"), '"a\nb');
});

test("comments and quoted or unquoted URLs retain string context", () => {
  assert.equal(
    decodeCssEscapes(String.raw`/* " \3c */`),
    String.raw`/* " \3c */`,
  );
  assert.equal(decodeCssEscapes('/* " */ "a\\\nb"'), '/* " */ "ab"');
  assert.equal(
    decodeCssEscapes('u\\72l(foo/*bar) "a\\\nb"'),
    'url(foo/*bar) "ab"',
  );
  assert.equal(decodeCssEscapes('url("a\\\nb")'), 'url("ab")');
});
