import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { verifyModuleScoping } from "../packages/mokly/dist/build/styles/module_verify.js";
import { scopeModule } from "../packages/mokly/dist/build/styles/modules.js";

import { pluginModuleOutput } from "./helpers/css_module_plugin_output.js";

const relative = "entries/shipped.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

test("verifier models cleaned plugin input while the early guard handles authored escapes", () => {
  const css = String.raw`.a\31/**/ .b{color:red}`;
  const output = pluginModuleOutput(css, relative, prefix).css;
  assert.doesNotThrow(() => verifyModuleScoping(css, output, relative, prefix));
});

for (const [name, css] of [
  [
    "arrow comment and line feed",
    String.raw`:global(.icon-\2192/* arrow */)` + "\n.label{color:red}",
  ],
  ["hex comment and tab", String.raw`:global(.a\31/**/)` + "\t.b{color:red}"],
  [
    "six-digit hex comment and space",
    String.raw`:global(.a\000031/**/) .b{color:red}`,
  ],
  [
    "local arrow comment and line feed",
    String.raw`:local(.a\2192/**/)` + "\n.b{color:red}",
  ],
  ["adjacent comments", String.raw`.a\31/**//**/` + "\n.b{color:red}"],
  ["comma-space list", String.raw`.x :global(.a\31/**/, .b){color:red}`],
  ["nested rule", String.raw`.outer{:global(.a\31/**/)` + "\t.b{color:red}}"],
  [
    "scope start",
    String.raw`@scope (:global(.a\31/**/)` +
      "\t.b) to (.limit){.target{color:red}}",
  ],
  [
    "scope limit",
    String.raw`@scope (.root) to (:global(.a\31/**/)` +
      "\t.b){.target{color:red}}",
  ],
  [
    "unchanged outside comment",
    `@scope ([data-a]) /* c */ to ([data-b]){.target{color:red}}`,
  ],
  [
    "unchanged inside comment",
    `@scope ([data-a] /* c */ div) to ([data-b]){.target{color:red}}`,
  ],
  [
    "unchanged kept comments",
    `@scope ([data-a])/**/to/**/([data-b]){.target{color:red}}`,
  ],
  [
    "changed outside comment",
    `@scope (.a) /* c */ to (.b){.target{color:red}}`,
  ],
  ["unchanged rule comment", `[data-x] /* c */ div{color:red}`],
  ["compound list", String.raw`.x :global(.a\31/**/,.b){color:red}`],
  ["child with separated comment", "ul > /* direct */ li{color:red}"],
  ["child with attached comment", "ul >/* c */ li{color:red}"],
  ["attribute child", "[x]>/**/ [x]{color:red}"],
  ["multiline child", "ul\n  > /* c */\n  li{color:red}"],
  ["adjacent sibling", "div + /* c */ p{color:red}"],
  ["general sibling", "div ~ /* c */ p{color:red}"],
  ["tab after adjacent sibling", "div + /* c */\tp{color:red}"],
  ["newline after general sibling", "div ~/**/\np{color:red}"],
  ["two comments after child", "div > /* a */ /* b */ p{color:red}"],
  ["comments on both sides of child", "div /* a */ > /* b */ p{color:red}"],
  ["namespaced child", "ns|div > /* c */ p{color:red}"],
  ["column combinator", "div || /* c */ td{color:red}"],
  ["nth-child spaced addition", "li:nth-child(2n + /* c */ 1){color:red}"],
  ["nth-child compact addition", "li:nth-child(2n+/* c */ 1){color:red}"],
  ["relative has child", ":has(> /* c */ p){color:red}"],
  ["nested child", ".p { & > /* c */ li { color:red } }"],
  ["scope child", "@scope ([data-a] > /* c */ div) { .target {color:red} }"],
  ["selector list child", "ul > /* c */ li, ol > li{color:red}"],
  ["no space after comment", "ul > /* c */li{color:red}"],
  ["comment before child", "ul /* c */ > li{color:red}"],
  ["ordinary comment descendant", "div /* c */ p{color:red}"],
  ["changed local child", ".a > /* c */ .b{color:red}"],
  ["comment before relative has child", ":has(/* c */ > p){color:red}"],
  ["two explicit combinators", "div > /* a */ + p{color:red}"],
] as const)
  test(`Build ships plugin CSS for ${name}`, () => {
    const expected = pluginModuleOutput(css, relative, prefix);
    const actual = scopeModule(css, relative);
    assert.equal(actual.css, expected.css);
    assert.deepEqual(actual.exports, expected.exports);
  });

for (const [name, css, expected] of [
  [
    "output-created escape",
    String.raw`:global(.a\000031) .b{color:red}`,
    `CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`,
  ],
  [
    "authored comment after escape",
    String.raw`:global(.a\31)/**/ .b{color:red}`,
    `CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`,
  ],
  [
    "unsafe authored escape",
    `.a\\31\t.b{color:red}`,
    `CSS Modules cannot safely scope an escape in ${relative}:1:1; write the escape with at most five hex digits followed by exactly one space, then any spacing or comment`,
  ],
  [
    "empty wrapper",
    `:global(,){color:red}`,
    `CSS Modules :global() has no selector in ${relative}:1:1; add a selector inside it or remove it`,
  ],
  [
    "empty wrapper between explicit combinators",
    `.a > :global(,) + .b{color:red}`,
    `CSS Modules :global() has no selector in ${relative}:1:1; add a selector inside it or remove it`,
  ],
  [
    "adjacent combinators without an ignored comment",
    `:global(.x >) .y{color:red}`,
    `CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`,
  ],
] as const)
  test(`Build retains ${name} rejection`, () => {
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(error.message, `[mokly/build-invalid] ${expected}`);
        return true;
      },
    );
  });
