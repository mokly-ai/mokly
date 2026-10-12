import assert from "node:assert/strict";
import test from "node:test";

import { styleNeedsFullValidation } from "../dist/review/style_source_safety.js";

function unsafe(text: string): boolean {
  const source = `<style>${text}</style>`;
  return styleNeedsFullValidation({
    source,
    text,
    start: 0,
    end: source.length,
    contentStart: 7,
    contentEnd: 7 + text.length,
  });
}

test("the guard covers decoded marker pieces independently of serializer joining", () => {
  for (const prefix of [
    "<! --",
    "<!/**/--",
    "< !--",
    "</**/!--",
    "<\t/*x*/ !\n--",
    "<--!!/*x*/ -",
    "<",
  ])
    assert.equal(unsafe(`${prefix}MoKlY-material:`), true, prefix);
  assert.equal(unsafe(String.raw`\3c !/**/--mokly-component:`), true);
  for (const text of [
    'content:"less < more"',
    String.raw`.md\:flex`,
    String.raw`content:"\201C"`,
    "<! --moKly-",
    '<!"--mokly-',
    "<!+--mokly-",
  ])
    assert.equal(unsafe(text), false, text);
});

test("guard-only continuation removal also covers non-string source", () => {
  for (const newline of ["\n", "\r", "\r\n", "\f"])
    assert.equal(unsafe(`--x:<! --mok\\${newline}ly-review-material:`), true);
  assert.equal(unsafe('"\\3c !--mok\\\nly-component:"'), true);
});
