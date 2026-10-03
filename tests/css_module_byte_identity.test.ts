import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { verifyModuleScoping } from "../dist/build/styles/module_verify.js";
import { scopeModule } from "../dist/build/styles/modules.js";

import { pluginModuleOutput } from "./helpers/css_module_plugin_output.js";

const relative = "entries/byte-identical.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
const changed = `[mokly/build-invalid] CSS Modules scoping would change more than local names in ${relative}:1:1; move this CSS to a plain stylesheet`;

for (const css of [
  String.raw`::part(a\,/**/b){color:red}`,
  String.raw`::part(a\ /**/b){color:red}`,
  String.raw`div\ /* c */p{color:red}`,
  String.raw`div\/* c */ p{color:red}`,
] as const)
  test(`byte-identical selector builds unchanged: ${css}`, () => {
    const expected = pluginModuleOutput(css, relative, prefix);
    const actual = scopeModule(css, relative);
    assert.equal(actual.css, css);
    assert.equal(actual.css, expected.css);
    assert.deepEqual(actual.exports, expected.exports);
  });

test("byte-identical scope prelude builds while its child is still scoped", () => {
  const css = String.raw`@scope ([data-a\,/**/b]) to (div){.x{color:red}}`;
  const expected = pluginModuleOutput(css, relative, prefix);
  const actual = scopeModule(css, relative);
  assert.equal(actual.css, expected.css);
  assert.ok(actual.css.includes(String.raw`@scope ([data-a\,/**/b]) to (div)`));
  assert.ok(actual.css.includes(`.${prefix}x`));
});

test("byte-identical non-hex scope prelude uses the identity shortcut", () => {
  const css = String.raw`@scope (div\ /* c */p) to (div){.x{color:red}}`;
  const expected = pluginModuleOutput(css, relative, prefix);
  const actual = scopeModule(css, relative);
  assert.equal(actual.css, expected.css);
  assert.ok(actual.css.includes(String.raw`@scope (div\ /* c */p) to (div)`));
  assert.ok(actual.css.includes(`.${prefix}x`));
});

for (const css of [
  String.raw`:global(.a\31)/**/ .b{color:red}`,
  String.raw`:global(.a\000031) .b{color:red}`,
  `:global(.x >) .y{color:red}`,
] as const)
  test(`changed shipped selector still fails: ${css}`, () => {
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(error.message, changed);
        return true;
      },
    );
  });

test("one added space still takes the normal selector comparison", () => {
  assert.throws(
    () =>
      verifyModuleScoping(
        ".a.b{color:red}",
        ".a .b{color:red}",
        relative,
        prefix,
      ),
    (error: Error) => {
      assert.equal(error.message, changed);
      return true;
    },
  );
});

test("one removed comment still takes the normal selector comparison", () => {
  assert.throws(
    () =>
      verifyModuleScoping(
        ".a/**/b{color:red}",
        ".ab{color:red}",
        relative,
        prefix,
      ),
    (error: Error) => {
      assert.equal(error.message, changed);
      return true;
    },
  );
});

test("identical selector text does not skip declaration comparison", () => {
  const selector = String.raw`::part(a\,/**/b)`;
  assert.throws(
    () =>
      verifyModuleScoping(
        `${selector}{color:red}`,
        `${selector}{color:blue}`,
        relative,
        prefix,
      ),
    (error: Error) => {
      assert.equal(error.message, changed.replace(":1:1;", ":1:18;"));
      return true;
    },
  );
});

test("identical scope text does not skip its child comparison", () => {
  const prelude = String.raw`@scope ([data-a\,/**/b]) to (div)`;
  assert.throws(
    () =>
      verifyModuleScoping(
        `${prelude}{.x{color:red}}`,
        `${prelude}{.x{color:blue}}`,
        relative,
        prefix,
      ),
    /CSS Modules scoping would change more than local names/,
  );
});
