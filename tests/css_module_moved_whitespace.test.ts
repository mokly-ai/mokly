import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { scopeModule } from "../packages/mokly/dist/build/styles/modules.js";

import { pluginModuleOutput } from "./helpers/css_module_plugin_output.js";

const relative = "entries/whitespace.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const css of [
  ".w:global(.x, ):hover{color:red}",
  ".w:global(.x ,):hover{color:red}",
  ".w:global(.x, )/**/:hover{color:red}",
  ".w:local(.x, ):hover{color:red}",
  ".w:global(.a, ):global(.x){color:red}",
  ".w:global(.x, ) .tail{color:red}",
  ".w:global(.x, )> .tail{color:red}",
  ".w:global(.x, ){color:red}",
  ".a:is(.b, :global(.x, )).c{color:red}",
  ".a:is(.b, :global(.x, ))>.c{color:red}",
  ".a:is(.b, :global(.x, )){color:red}",
  ".a:is(.b, :local(.x, )).c{color:red}",
  "::slotted(:global(.x, )) .tail{color:red}",
  ".w :global(.x, , .y){color:red}",
] as const)
  test(`wrapper-owned moved whitespace follows plugin output: ${css}`, () => {
    const expected = pluginModuleOutput(css, relative, prefix);
    const actual = scopeModule(css, relative);
    assert.equal(actual.css, expected.css);
    assert.deepEqual(actual.exports, expected.exports);
  });

for (const [css, location] of [
  [".card:is(.a, ).b{color:red}", "1:1"],
  [".a:is(.b, :global(.x, ), ).c{color:red}", "1:1"],
  [".a:is(.b, ):global(.y){color:red}", "1:1"],
  [".card:where(.a, ).b{color:red}", "1:1"],
  [".card:not(.a, ).b{color:red}", "1:1"],
  [".card:has(.a, ).b{color:red}", "1:1"],
  [".card:nth-child(2 of .a, ).b{color:red}", "1:1"],
  [".card:host(.a, ).b{color:red}", "1:1"],
  [".card::slotted(.a, ).b{color:red}", "1:1"],
  [".card{&:is(.a, ).b{color:red}}", "1:7"],
  ["@scope (.card:is(.a, ).b) to (.limit){.target{color:red}}", "1:1"],
  ["@scope (.card) to (.limit:is(.a, ).b){.target{color:red}}", "1:1"],
  [".w :global(.a,:is(.b, ),.c){color:red}", "1:1"],
] as const)
  test(`other pseudo's moved whitespace fails Build: ${css}`, () => {
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

for (const [css, wrapper, location] of [
  [":global(){color:red}", ":global()", "1:1"],
  [":global( ){color:red}", ":global()", "1:1"],
  [":global(,){color:red}", ":global()", "1:1"],
  [":global(/* c */){color:red}", ":global()", "1:1"],
  [":local(/* c */, /* d */){color:red}", ":local()", "1:1"],
  ["[a]:global(,)div{color:red}", ":global()", "1:1"],
  [":global(,), .b{color:red}", ":global()", "1:1"],
  [".a > :global(,) + .b{color:red}", ":global()", "1:1"],
  [".a:is(:local()){color:red}", ":local()", "1:1"],
  [".outer{\n:global(){color:red}\n}", ":global()", "2:1"],
  ["@scope (.a :global()){.x{color:red}}", ":global()", "1:1"],
  ["@scope (.a) to (:local(/* x */)){.x{color:red}}", ":local()", "1:1"],
] as const)
  test(`all-empty ${wrapper} fails before plugins: ${css}`, () => {
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules ${wrapper} has no selector in ${relative}:${location}; add a selector inside it or remove it`,
        );
        return true;
      },
    );
  });
