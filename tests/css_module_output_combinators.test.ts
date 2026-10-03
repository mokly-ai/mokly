import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { scopeModule } from "../dist/build/styles/modules.js";

const relative = "entries/combinators.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const [css, location] of [
  [String.raw`:global(.a\000031) .b{color:red}`, "1:1"],
  [":global(.a\\1f)\t.b{color:red}", "1:1"],
  [String.raw`.x :global(.a\000031, .b){color:red}`, "1:1"],
  [String.raw`.w:global(.a\000031, ):hover{color:red}`, "1:1"],
  [String.raw`:local(.a\00006a) .b{color:red}`, "1:1"],
  [String.raw`.outer{& :global(.a\000031) .b{color:red}}`, "1:8"],
  [
    String.raw`@scope (:global(.a\000031) .b) to (.limit){.x{color:red}}`,
    "1:1",
  ],
  [String.raw`@scope (.root) to (:global(.a\000031) .b){.x{color:red}}`, "1:1"],
  [String.raw`.root:is(:global(.a\000031) .b){color:red}`, "1:1"],
] as const)
  test(`scoping rejects escape-swallowed output combinator ${JSON.stringify(css)}`, () => {
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${relative}:${location}; move this CSS to a plain stylesheet`,
        );
        return true;
      },
    );
  });

for (const css of [
  String.raw`:global(.a\000031)  .b{color:red}`,
  String.raw`:local(.a\00006A) .b{color:red}`,
  String.raw`:global(.a\000031)> .b{color:red}`,
  String.raw`:global(.a\000031)+ .b{color:red}`,
  String.raw`:global(.a\000031)~ .b{color:red}`,
] as const)
  test(`scoping preserves genuine output combinator ${JSON.stringify(css)}`, () => {
    const output = scopeModule(css, relative).css;
    assert.ok(output.includes(prefix));
  });
