import assert from "node:assert/strict";
import test from "node:test";

import { verifyModuleScoping } from "../dist/build/styles/module_verify.js";

const file = "entries/check.module.css";
const prefix = "mokly_123456789abc_";

for (const [name, input, output] of [
  [
    "class and ID",
    ".x#hero{color:red}",
    `.${prefix}x#${prefix}hero{color:red}`,
  ],
  [
    "escaped class identifier",
    ".top-\\(--active-tab-top\\){top:0}",
    `.${prefix}top-\\(--active-tab-top\\){top:0}`,
  ],
  [
    "nested selectors",
    ".x{& .y{color:red}}",
    `.${prefix}x{& .${prefix}y{color:red}}`,
  ],
  [
    "local/global selector forms",
    ":global(.g) :local(.x){color:red}",
    `.g .${prefix}x{color:red}`,
  ],
  [
    "local/global inside nested pseudos",
    ":is(:global(.g),:not(:local(.x))){color:red}",
    `:is(.g,:not(.${prefix}x)){color:red}`,
  ],
  [
    "bare selector modes",
    ".x :global .a .b{color:red}",
    `.${prefix}x .a .b{color:red}`,
  ],
  ["bare global at start", ":global .g1 .g2{color:red}", ".g1 .g2{color:red}"],
  [
    "class attribute",
    '[class="x"]{color:red}',
    `[class='${prefix}x']{color:red}`,
  ],
  [
    "composition removal",
    ".a{} .b{composes:a;color:red}",
    `.${prefix}a{} .${prefix}b{color:red}`,
  ],
  [
    "case-insensitive compose-with removal",
    ".a{COMPOSE-WITH:global(foo);color:red}",
    `.${prefix}a{color:red}`,
  ],
  [
    "global composition removal",
    ".a{composes: g from global;color:red}",
    `.${prefix}a{color:red}`,
  ],
  [
    "animation value",
    ".x{animation:fade 1s;animation-name:fade}",
    `.${prefix}x{animation:${prefix}fade 1s;animation-name:${prefix}fade}`,
  ],
  [
    "local/global values",
    ".x{animation:local(fade) 1s, global(spin) 2s}",
    `.${prefix}x{animation:${prefix}fade 1s, spin 2s}`,
  ],
  [
    "font local forms",
    '@font-face{src:local(Arial),local("Arial")}',
    '@font-face{src:local(Arial),local("Arial")}',
  ],
  [
    "keyframes",
    "@keyframes fade{from{opacity:0}}",
    `@keyframes ${prefix}fade{from{opacity:0}}`,
  ],
  [
    "vendor keyframes",
    "@-webkit-keyframes fade{from{opacity:0}}",
    `@-webkit-keyframes ${prefix}fade{from{opacity:0}}`,
  ],
  [
    "global keyframes",
    "@keyframes :global(fade){to{opacity:1}}",
    "@keyframes fade{to{opacity:1}}",
  ],
  [
    "conditional and comments",
    "/* c */@media (min-width: 1px){.x{color:red}}",
    `/* c */@media (min-width: 1px){.${prefix}x{color:red}}`,
  ],
  [
    "scope groups",
    "@scope (.button) to (:scope > .footer){.x{color:red}}",
    `@scope (.${prefix}button) to (:scope > .${prefix}footer){.${prefix}x{color:red}}`,
  ],
  [
    "custom animation property",
    ".x{--enter-animation:fade 1s}",
    `.${prefix}x{--enter-animation:${prefix}fade 1s}`,
  ],
] as const)
  test(`rename-only check accepts ${name}`, () => {
    assert.doesNotThrow(() => verifyModuleScoping(input, output, file, prefix));
  });

for (const [name, input, output, location] of [
  ["changed value", ".x{color:red}", `.${prefix}x{color:blue}`, "1:4"],
  [
    "dropped declaration",
    ".x{color:red;opacity:1}",
    `.${prefix}x{color:red}`,
    "1:14",
  ],
  [
    "dropped rule",
    ".x{color:red}.y{color:blue}",
    `.${prefix}x{color:red}`,
    "1:14",
  ],
  [
    "reordered rule",
    ".x{color:red}.y{color:blue}",
    `.${prefix}y{color:blue}.${prefix}x{color:red}`,
    "1:1",
  ],
  [
    "changed at-rule",
    "@media screen{.x{color:red}}",
    `@media print{.${prefix}x{color:red}}`,
    "1:1",
  ],
  [
    "leaked local function",
    ".x{animation:fade auto linear}",
    `.${prefix}x{animation:${prefix}fade :local(auto) linear}`,
    "1:1",
  ],
  [
    "prefix glued to string",
    '@keyframes "pulse"{to{opacity:1}}',
    `@keyframes ${prefix}"pulse"{to{opacity:1}}`,
    "1:1",
  ],
  [
    "broken scope",
    "@scope (.button){.x{color:red}}",
    `@scope (.${prefix}bu) to (){.${prefix}x{color:red}}`,
    "1:1",
  ],
  [
    "changed comment",
    "/* good */.x{color:red}",
    `/* bad */.${prefix}x{color:red}`,
    "1:1",
  ],
  ["changed string", '.x{content:"red"}', `.${prefix}x{content:"blue"}`, "1:4"],
  [
    "changed function",
    ".x{color:rgb(1,2,3)}",
    `.${prefix}x{color:hsl(1,2,3)}`,
    "1:4",
  ],
  [
    "changed importance",
    ".x{color:red!important}",
    `.${prefix}x{color:red}`,
    "1:4",
  ],
] as const)
  test(`rename-only check rejects ${name}`, () => {
    assert.throws(
      () => verifyModuleScoping(input, output, file, prefix),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${file}:${location}; move this CSS to a plain stylesheet`,
        );
        return true;
      },
    );
  });

test("unparseable output names the later authored rule, not the first rule", () => {
  const input = ".ok{color:red}\n.x{animation:fade auto linear}";
  const output = `.${prefix}ok{color:red}\n.${prefix}x{animation:${prefix}fade :local(auto) linear}`;
  assert.throws(
    () => verifyModuleScoping(input, output, file, prefix),
    (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${file}:2:1; move this CSS to a plain stylesheet`,
      );
      return true;
    },
  );
});
