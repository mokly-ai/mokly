import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { verifyModuleScoping } from "../dist/build/styles/module_verify.js";
import { scopeModule } from "../dist/build/styles/modules.js";

import { pluginModuleOutput } from "./helpers/css_module_plugin_output.js";

const relative = "entries/lists.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const [input, pluginSelector] of [
  [".w :global(.x,.y)", ".M_w .x.y"],
  [".w :global(.x, .y)", ".M_w .x .y"],
  [".w :global(.x,\n.y)", ".M_w .x\n.y"],
  [".w :global(.x,\t.y)", ".M_w .x\t.y"],
  [".w :global(.x,,.y)", ".M_w .x.y"],
  [".w :global(.x, , .y)", ".M_w .x .y"],
  [".w :global(.x, ,.y)", ".M_w .x .y"],
  [".w :global(, .x)", ".M_w .x"],
  [".w :global(.x, .y,)", ".M_w .x .y"],
  [".w :global(.x/**/,.y)", ".M_w .x/**/.y"],
  [".w :global(.x,/**/.y)", ".M_w .x.y"],
  [".w :global(.x /**/,.y)", ".M_w .x .y"],
  [".w :global(.x/**/ ,.y)", ".M_w .x .y"],
  [".w :global(.x, /* c */, .y)", ".M_w .x .y"],
  [".w :global(/* c */.x, .y)", ".M_w /* c */.x .y"],
  [".w :global(.x, .y/* c */) .z", ".M_w .x .y/* c */ .M_z"],
  [":global(.x,.y).z", ".x.y.M_z"],
  [".w:global(.x,.y)", ".M_w.x.y"],
  [".w :global(div,.x)", ".M_w div.x"],
  [".w :local(.x,.y)", ".M_w .M_x.M_y"],
  [".w :global(.x,/*c*/,.y)", ".M_w .x.y"],
  [".w :global(.x/*c*/)", ".M_w .x/*c*/"],
  [".w :local(.x/*c*/)", ".M_w .M_x/*c*/"],
  [".w :not(:global(.x,.y))", ".M_w :not(.x.y)"],
  [".w :global(:is(.x, .y))", ".M_w :is(.x, .y)"],
] as const)
  test(`CSS Module follows plugin join for ${JSON.stringify(input)}`, () => {
    const css = `${input}{color:red}`;
    const plugin = pluginModuleOutput(css, relative, "M_");
    assert.equal(plugin.css, `${pluginSelector}{color:red}`);
    const actual = scopeModule(css, relative);
    const expected = pluginModuleOutput(css, relative, prefix);
    assert.equal(actual.css, expected.css);
    assert.deepEqual(actual.exports, expected.exports);
  });

for (const input of [
  ".w :global(div,span)",
  ".w :global(.x,div)",
  ".w :global([a],div)",
  ".w:global(div)",
  ".w :global([a],*)",
  ".w :local(div,span)",
] as const)
  test(`CSS Module rejects a newly invalid compound: ${input}`, () => {
    assert.throws(
      () => scopeModule(`${input}{color:red}`, relative),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`,
        );
        return true;
      },
    );
  });

test("an authored invalid compound outside a wrapper is not newly judged", () => {
  const css = "[a]div{color:red}";
  assert.equal(
    scopeModule(css, relative).css,
    pluginModuleOutput(css, relative, prefix).css,
  );
});

for (const [input, output] of [
  [".x/**/.y{color:red}", `.${prefix}x .${prefix}y{color:red}`],
  [".x /* c */ .y{color:red}", `.${prefix}x.${prefix}y{color:red}`],
] as const)
  test(`selector comments cannot hide changed combinators: ${input}`, () => {
    assert.throws(
      () => verifyModuleScoping(input, output, relative, prefix),
      /CSS Modules scoping would change more than local names/,
    );
  });

test("a selector comment hoisted before a nonempty wrapper rule is ignored", () => {
  assert.doesNotThrow(() =>
    verifyModuleScoping(
      ":global(/* c */.x) .tail{color:red}",
      `/* c */.x .${prefix}tail{color:red}`,
      relative,
      prefix,
    ),
  );
});
