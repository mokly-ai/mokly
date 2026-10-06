import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  recordModuleIdentities,
  scopeModule,
} from "../packages/mokly/dist/build/styles/modules.js";

const relative = "entries/card.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

test("CSS Module names use only the POSIX repository path and preserve authored CSS", () => {
  const css = `@import "./base.css" layer(base) supports(display: grid) screen;
/* authored comment */
@keyframes pulse{to{opacity:1}}
:global(.keep) :local(.card){--icon:url("./icon.svg");background:image-set(url("./a.png") 1x);animation:pulse 1s;color:var(--brand)}
#hero{color:red}
`;
  const first = scopeModule(css, relative);
  const changed = scopeModule(css.replace("color:red", "color:blue"), relative);
  assert.deepEqual(first.exports, {
    card: `${prefix}card`,
    hero: `${prefix}hero`,
    pulse: `${prefix}pulse`,
  });
  assert.equal(first.exports.card, changed.exports.card);
  assert.equal(
    first.css.replaceAll(prefix, ""),
    css.replace(":global(.keep) :local(.card)", ".keep .card"),
  );
});

test("CSS Module exports own name before earlier local and global composes", () => {
  const scoped = scopeModule(
    ".base{color:blue}.card{composes:base;composes:utility from global;color:red}",
    relative,
  );
  assert.deepEqual(scoped.exports, {
    base: `${prefix}base`,
    card: `${prefix}card ${prefix}base utility`,
  });
  assert.doesNotMatch(scoped.css, /composes:/);
});

test("a package CSS Module keeps authored fallback declarations", () => {
  const css =
    ".x{width:-webkit-fill-available;width:-moz-available;width:stretch;height:100vh;height:100dvh}";
  const scoped = scopeModule(css, "node_modules/@acme/ui/card.module.css");
  assert.equal(scoped.css.replace(/mokly_[a-f0-9]{12}_/g, ""), css);
});

test("distinct module files cannot claim the same generated identity", () => {
  const known = new Map<string, string>();
  recordModuleIdentities(
    new Set(["mokly_deadbeefdead_card"]),
    "entries/a.module.css",
    known,
  );
  assert.throws(
    () =>
      recordModuleIdentities(
        new Set(["mokly_deadbeefdead_card"]),
        "entries/b.module.css",
        known,
      ),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules generated name collision: mokly_deadbeefdead_card in entries/a.module.css and entries/b.module.css; rename one local name or file",
      );
      return true;
    },
  );
});

test("CSS Modules reject forward and cross-file composition with authored locations", () => {
  assert.throws(
    () => scopeModule(".card{composes:base}.base{color:red}", relative),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules composition refers to a class not yet defined in entries/card.module.css:1:7: base; define the composed class before this rule",
      );
      return true;
    },
  );
  assert.throws(
    () =>
      scopeModule('.card{composes:base from "./base.module.css"}', relative),
    /CSS Modules cross-file composes is unsupported in entries\/card.module.css: \.\/base.module.css; compose within this file or use a global name/,
  );
});

for (const [css, message] of [
  [
    ":export{theme:blue}.card{color:red}",
    "CSS Modules authored ICSS rule is unsupported in entries/card.module.css:1:1: :export; use local class exports or ordinary CSS",
  ],
  [
    ':import("./base.css"){theme:blue}.card{color:red}',
    'CSS Modules authored ICSS rule is unsupported in entries/card.module.css:1:1: :import("./base.css"); use local class exports or ordinary CSS',
  ],
  [
    "@value brand: red;.card{color:brand}",
    "CSS Modules @value is unsupported in entries/card.module.css:1:1; use a CSS custom property or JavaScript constant",
  ],
  [
    "@icss-export{theme:blue}.card{color:red}",
    "CSS Modules authored ICSS rule is unsupported in entries/card.module.css:1:1: @icss-export; use local class exports or ordinary CSS",
  ],
  [
    '@icss-import "./base.css"{theme:blue}.card{color:red}',
    "CSS Modules authored ICSS rule is unsupported in entries/card.module.css:1:1: @icss-import; use local class exports or ordinary CSS",
  ],
] as const)
  test(`CSS Module rejects unsupported authored syntax: ${css.slice(0, 12)}`, () => {
    assert.throws(
      () => scopeModule(css, relative),
      (error: Error) => {
        assert.equal(error.message, `[mokly/build-invalid] ${message}`);
        return true;
      },
    );
  });

test("composition on a descendant selector has a product-language location", () => {
  assert.throws(
    () => scopeModule(".base{color:red}.a .b{composes:base}", relative),
    /CSS Modules composition requires a single local class in entries\/card\.module\.css:1:\d+; compose from a local class selector/,
  );
});

test("plugin failures on later lines report their authored location without internals", () => {
  assert.throws(
    () => scopeModule(".ok{color:red}\n.a .b{composes:ok}", relative),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules composition requires a single local class in entries/card.module.css:2:7; compose from a local class selector",
      );
      assert.doesNotMatch(
        error.message,
        /postcss-modules|\/home\/|node_modules/,
      );
      return true;
    },
  );
});
