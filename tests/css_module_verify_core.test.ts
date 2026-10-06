import assert from "node:assert/strict";
import test from "node:test";

import { verifyModuleScoping } from "../packages/mokly/dist/build/styles/module_verify.js";

const file = "entries/check.module.css";
const prefix = "mokly_123456789abc_";

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
