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

for (const [name, input, output] of [
  [
    "global list after a class",
    ".wrap :global(.x, .y)",
    `.${prefix}wrap .x .y`,
  ],
  [
    "global list before a class",
    ":global(.x, .y) .wrap",
    `.x .y .${prefix}wrap`,
  ],
  [
    "global list attached to a compound",
    ".wrap:global(.x, .y)",
    `.${prefix}wrap.x .y`,
  ],
  [
    "complex global list",
    ".wrap :global(.x > .a, .y) .z",
    `.${prefix}wrap .x > .a .y .${prefix}z`,
  ],
  [
    "three global list items",
    ".wrap :global(.x, .y, .w)",
    `.${prefix}wrap .x .y .w`,
  ],
  [
    "local list",
    ".wrap :local(.x, .y)",
    `.${prefix}wrap .${prefix}x .${prefix}y`,
  ],
  [
    "bare global before local list",
    ":global .g :local(.x, .y)",
    `.g .${prefix}x .${prefix}y`,
  ],
  ["list inside is", ".a :is(:global(.x, .y))", `.${prefix}a :is(.x .y)`],
  [
    "list inside not",
    ".wrap :not(:global(.x, .y))",
    `.${prefix}wrap :not(.x .y)`,
  ],
  [
    "explicit alternatives",
    ".wrap :global(.x), .wrap :global(.y)",
    `.${prefix}wrap .x, .${prefix}wrap .y`,
  ],
  [
    "is alternative",
    ".wrap :global(:is(.x, .y))",
    `.${prefix}wrap :is(.x, .y)`,
  ],
  [
    "bare global between lists",
    ".wrap :global .g :local(.x, .y) .tail",
    `.${prefix}wrap .g .${prefix}x .${prefix}y .tail`,
  ],
  [
    "bare global after local list",
    ".wrap :local(.x, .y) :global .g",
    `.${prefix}wrap .${prefix}x .${prefix}y .g`,
  ],
  [
    "nested ampersand global list",
    ".wrap{& :global(.x, .y){color:red}}",
    `.${prefix}wrap{& .x .y{color:red}}`,
  ],
  [
    "nested ampersand local list",
    ".wrap{& :local(.x, .y){color:red}}",
    `.${prefix}wrap{& .${prefix}x .${prefix}y{color:red}}`,
  ],
] as const)
  test(`rename-only check accepts selector list ${name}`, () => {
    const original = input.includes("{") ? input : `${input}{color:red}`;
    const changed = output.includes("{") ? output : `${output}{color:red}`;
    assert.doesNotThrow(() =>
      verifyModuleScoping(original, changed, file, prefix),
    );
  });

for (const [name, input, output] of [
  [
    "both scope groups",
    "@scope (.wrap :global(.x, .y)) to (.foot :local(.a, .b)){.target{color:red}}",
    `@scope (.${prefix}wrap .x .y) to (.${prefix}foot .${prefix}a .${prefix}b){.${prefix}target{color:red}}`,
  ],
  [
    "reversed scope modes",
    "@scope (.wrap :local(.x, .y)) to (.foot :global(.a, .b)){.target{color:red}}",
    `@scope (.${prefix}wrap .${prefix}x .${prefix}y) to (.${prefix}foot .a .b){.${prefix}target{color:red}}`,
  ],
  [
    "ampersand scope start",
    "@scope (& :global(.x, .y)) to (:scope > .limit){.target{color:red}}",
    `@scope (& .x .y) to (:scope > .${prefix}limit){.${prefix}target{color:red}}`,
  ],
] as const)
  test(`rename-only check accepts selector lists in ${name}`, () => {
    assert.doesNotThrow(() => verifyModuleScoping(input, output, file, prefix));
  });

for (const [name, changed] of [
  ["reordered items", `.${prefix}wrap .y .x`],
  ["missing item", `.${prefix}wrap .x`],
  ["non-descendant join", `.${prefix}wrap .x > .y`],
] as const)
  test(`rename-only check rejects selector list ${name}`, () => {
    assert.throws(
      () =>
        verifyModuleScoping(
          ".wrap :global(.x, .y){color:red}",
          `${changed}{color:red}`,
          file,
          prefix,
        ),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${file}:1:1; move this CSS to a plain stylesheet`,
        );
        return true;
      },
    );
  });
