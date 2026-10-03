import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { scopeModule } from "../dist/build/styles/modules.js";

const relative = "entries/escape.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
const changed = `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`;
const unsafe = (location: string) =>
  `[mokly/build-invalid] CSS Modules cannot safely scope an escape in ${relative}:${location}; write the escape with at most five hex digits followed by exactly one space, then any spacing or comment`;

for (const [selector, expected] of [
  [String.raw`:global(.a\31) .b`, changed],
  [String.raw`.x :global(.a\31, .b)`, changed],
  [String.raw`.w:global(.a\31, ):hover`, changed],
  [String.raw`:global(#a\31) .b`, changed],
  [String.raw`:local(.a\3a) .b`, changed],
  [String.raw`:global(.a\31 ).b`, String.raw`.a\31 .M_b{color:red}`],
  [String.raw`:global(.\31 ).card`, String.raw`.\31 .M_card{color:red}`],
  [`.w:global(.a\u00a0).b`, `.M_w.a\u00a0.M_b{color:red}`],
  [String.raw`.w :global(.a\31 ,.b)`, String.raw`.M_w .a\31 .b{color:red}`],
  [String.raw`.\32xl\:grid`, String.raw`.M_\32xl\:grid{color:red}`],
  [String.raw`.a\31.b`, String.raw`.M_a\31.M_b{color:red}`],
  [String.raw`:global(.a\31)`, String.raw`.a\31{color:red}`],
  [String.raw`.a\31 .b`, String.raw`.M_a\31 .M_b{color:red}`],
  [String.raw`.a\31\u00a0.b`, String.raw`.M_a\31\u00a0.M_b{color:red}`],
] as const)
  test(`CSS Module hex escape ${JSON.stringify(selector)}`, () => {
    const css = `${selector}{color:red}`;
    if (expected.startsWith("[mokly/")) {
      assert.throws(
        () => scopeModule(css, relative),
        (error: Error) => {
          assert.equal(error.message, expected);
          return true;
        },
      );
    } else {
      assert.equal(
        scopeModule(css, relative).css.replaceAll(prefix, "M_"),
        expected,
      );
    }
  });

test("a comment after intervening selector text does not trigger the escape guard", () => {
  assert.doesNotThrow(() =>
    scopeModule(String.raw`.a\31.b/**/ .c{color:red}`, relative),
  );
});

test("escaped quotes inside a wrapper selector build", () => {
  assert.doesNotThrow(() =>
    scopeModule(String.raw`.w :global([x="a\"b"], .y){color:red}`, relative),
  );
});

test("escaped quotes and parentheses inside scope groups build", () => {
  assert.doesNotThrow(() =>
    scopeModule(
      String.raw`@scope ([x="a\")"] .b) to (.c){.target{color:red}}`,
      relative,
    ),
  );
});

test("an actual no-break space after an escape stays in the class name", () => {
  assert.doesNotThrow(() => scopeModule(`.a\\31\u00a0.b{color:red}`, relative));
});

for (const [selector, location] of [
  [`.a\\31\t.b`, "1:1"],
  [`.a\\31\n.b`, "1:1"],
  [`.a\\31\r.b`, "1:1"],
  [`.a\\31\r\n.b`, "1:1"],
  [`.a\\31\f.b`, "1:1"],
  [String.raw`.a\000031 .b`, "1:1"],
  [String.raw`.a\31/**/ .b`, "1:1"],
  [String.raw`#a\31/**/ .b`, "1:1"],
  [String.raw`@scope (.a\31/**/ .b){.x{color:red}}`, "1:1"],
  [String.raw`@scope (.start) to (.a\31/**/ .b){.x{color:red}}`, "1:1"],
  [`.outer{\n.a\\31\t.b{color:red}}`, "2:1"],
  [String.raw`@scope (.a\000031 .b){.x{color:red}}`, "1:1"],
] as const)
  test(`unsafe CSS Module escape ${JSON.stringify(selector)}`, () => {
    const css = selector.includes("{color:red}")
      ? selector
      : `${selector}{color:red}`;
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(error.message, unsafe(location));
        return true;
      },
    );
  });

for (const [selector, expected] of [
  [String.raw`.a\31 .b`, String.raw`.M_a\31 .M_b{color:red}`],
  [String.raw`.a\000031.b`, String.raw`.M_a\000031.M_b{color:red}`],
  [String.raw`.a\31 /**/ .b`, String.raw`.M_a\31  .M_b{color:red}`],
  [String.raw`.a\31/**/.b`, String.raw`.M_a\31/**/.M_b{color:red}`],
] as const)
  test(`safe escape edit ${JSON.stringify(selector)}`, () => {
    assert.equal(
      scopeModule(`${selector}{color:red}`, relative).css.replaceAll(
        prefix,
        "M_",
      ),
      expected,
    );
  });
