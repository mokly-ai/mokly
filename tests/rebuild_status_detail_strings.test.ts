import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeRebuildFailure } from "../dist/server/rebuild_status_detail.js";

const introducers = [
  { name: "seven-bit OSC", value: "\u001B]" },
  { name: "seven-bit DCS", value: "\u001BP" },
  { name: "seven-bit SOS", value: "\u001BX" },
  { name: "seven-bit PM", value: "\u001B^" },
  { name: "seven-bit APC", value: "\u001B_" },
  { name: "eight-bit OSC", value: "\u009D" },
  { name: "eight-bit DCS", value: "\u0090" },
  { name: "eight-bit SOS", value: "\u0098" },
  { name: "eight-bit PM", value: "\u009E" },
  { name: "eight-bit APC", value: "\u009F" },
];
const terminators = [
  { name: "BEL", value: "\u0007" },
  { name: "seven-bit ST", value: "\u001B\\" },
  { name: "eight-bit ST", value: "\u009C" },
];
const payload = "secretfile:///private/work/repo/secret.ts\nprivate payload";
const fallback = "No additional details are available.";

for (const introducer of introducers) {
  for (const terminator of terminators) {
    test(`failure detail removes ${introducer.name} strings ending with ${terminator.name}`, () => {
      const raw = `before${introducer.value}${payload}${terminator.value}after`;
      assert.equal(
        sanitizeRebuildFailure(new Error(raw), "/repo"),
        "beforeafter",
      );
      assert.equal(
        sanitizeRebuildFailure(
          `${introducer.value}${payload}${terminator.value}`,
          "/repo",
        ),
        fallback,
      );
    });
  }

  test(`unterminated ${introducer.name} removes its payload through the end of the message`, () => {
    const raw = `${introducer.value}${payload}\u001B[31m\u001B`;
    assert.equal(sanitizeRebuildFailure(`Before ${raw}`, "/repo"), "Before");
    assert.equal(sanitizeRebuildFailure(raw, "/repo"), fallback);
    assert.equal(sanitizeRebuildFailure(introducer.value, "/repo"), fallback);
  });
}

test("the reviewer's eight-bit OSC file hyperlink keeps only its visible label", () => {
  const raw =
    "\u009D8;;file:///private/work/repo/secret.ts\u009CLabel\u009D8;;\u009C";
  assert.equal(sanitizeRebuildFailure(new Error(raw), "/repo"), "Label");
});

test("mixed terminal strings strip consecutive payloads and retain ordinary styled text", () => {
  const raw =
    "\u0090first\u001B\\\u001B^second\u009C\u009Fthird\u0007" +
    "\u001B[31mFailed\u009B0m\u001B]last\u009C\u0098discard to EOF";
  assert.equal(sanitizeRebuildFailure(raw, "/repo"), "Failed");
});

test("ASCII introducer markers are ordinary text without ESC", () => {
  assert.equal(
    sanitizeRebuildFailure("P X ] ^ _ payload", "/repo"),
    "P X ] ^ _ payload",
  );
});

test("a standalone eight-bit ST and other C1 controls do not remove ordinary text", () => {
  assert.equal(
    sanitizeRebuildFailure("before\u009Cmiddle\u0091after", "/repo"),
    "beforemiddleafter",
  );
});

test("an unterminated string cannot expose a payload larger than the detail bound", () => {
  assert.equal(
    sanitizeRebuildFailure(`\u009D${"secret".repeat(2_000)}`, "/repo"),
    fallback,
  );
});
