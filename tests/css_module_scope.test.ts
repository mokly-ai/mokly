import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import postcss from "postcss";

import {
  prepareModuleScopes,
  scanScopePrelude,
} from "../dist/build/styles/module_scope.js";
import {
  recordModuleIdentities,
  scopeModule,
} from "../dist/build/styles/modules.js";

const relative = "entries/scope.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const [params, start, limit] of [
  ["(.button)", ".button", undefined],
  ["to (.limit)", undefined, ".limit"],
  ["(.tooltip) to (.footer)", ".tooltip", ".footer"],
  ["(.button)to(.footer)", ".button", ".footer"],
  ["", undefined, undefined],
  [
    "/*a*/(.photo/*b*/)/*c*/TO/*d*/(:scope > .bottom)",
    ".photo/*b*/",
    ":scope > .bottom",
  ],
  [
    '(:is(.toast, [data-x="to )"]):not(.custom)) to (.footer, .limit)',
    ':is(.toast, [data-x="to )"]):not(.custom)',
    ".footer, .limit",
  ],
  [
    String.raw`(.bu\(tton) to (.fo\)oter)`,
    String.raw`.bu\(tton`,
    String.raw`.fo\)oter`,
  ],
] as const)
  test(`scan @scope prelude ${JSON.stringify(params)}`, () => {
    const parsed = scanScopePrelude(params);
    assert.equal(
      parsed.start && params.slice(parsed.start.start, parsed.start.end),
      start,
    );
    assert.equal(
      parsed.limit && params.slice(parsed.limit.start, parsed.limit.end),
      limit,
    );
  });

for (const params of [
  "()",
  "to ()",
  "(.button",
  "to",
  "(.button) to",
  "(.button) extra",
  "(.button) to (.limit) (.extra)",
  "(.button) to (.limit) to (.third)",
  "toaster (.button)",
  "(.button) to (.limit]",
] as const)
  test(`reject malformed @scope ${params}`, () => {
    assert.throws(() => scanScopePrelude(params));
    assert.throws(
      () => scopeModule(`@scope ${params}{.x{color:red}}`, relative),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules @scope prelude is invalid in ${relative}:1:1; use an optional (start) and/or to (limit)`,
        );
        return true;
      },
    );
  });

test("scope start and limit names containing to without changing other prelude bytes", () => {
  const params =
    "/*a*/(.button, :is(.tooltip, :global(.photo)))/*b*/TO/*c*/(.footer, .bottom)/*d*/";
  const result = scopeModule(`@scope ${params}{.inside{color:red}}`, relative);
  assert.equal(
    result.css,
    `@scope /*a*/(.${prefix}button, :is(.${prefix}tooltip, .photo))/*b*/TO/*c*/(.${prefix}footer, .${prefix}bottom)/*d*/{.${prefix}inside{color:red}}`,
  );
  assert.deepEqual(Object.keys(result.exports).sort(), [
    "bottom",
    "button",
    "footer",
    "inside",
    "tooltip",
  ]);
  assert.equal(result.identities.has(`${prefix}button`), true);
});

for (const [source, expected] of [
  ["@scope {.x{color:red}}", `@scope {.${prefix}x{color:red}}`],
  [
    "@scope to (.limit){.x{color:red}}",
    `@scope to (.${prefix}limit){.${prefix}x{color:red}}`,
  ],
  [
    "@SCOPE /*a*/(.button)/*b*/TO/*c*/(.footer){.x{color:red}}",
    `@SCOPE /*a*/(.${prefix}button)/*b*/TO/*c*/(.${prefix}footer){.${prefix}x{color:red}}`,
  ],
  [
    "@scope (:global .photo .button) to (:local .footer){.x{color:red}}",
    `@scope (.photo .button) to (.${prefix}footer){.${prefix}x{color:red}}`,
  ],
] as const)
  test(`scope integration preserves ${source.slice(0, 27)}`, () => {
    assert.equal(scopeModule(source, relative).css, expected);
  });

test("prelude-only class is available to later composes", () => {
  const result = scopeModule(
    "@scope (.card){.inside{color:red}}.special{composes:card;color:blue}",
    relative,
  );
  assert.equal(result.exports.special, `${prefix}special ${prefix}card`);
});

test("scope selectors share local/global and nested pseudo localization", () => {
  const result = scopeModule(
    "@scope (:is(.toast, :global(.photo)), :local(.button)) to (:scope > .footer:not(.bottom)){& .target{color:red}}",
    relative,
  );
  assert.match(
    result.css,
    new RegExp(
      `@scope \\(\\:is\\(\\.${prefix}toast, \\.photo\\), \\.${prefix}button\\) to \\(\\:scope > \\.${prefix}footer\\:not\\(\\.${prefix}bottom\\)\\)`,
    ),
  );
  assert.ok(result.css.includes(`& .${prefix}target`));
  assert.ok(!Object.hasOwn(result.exports, "photo"));
  assert.ok(Object.hasOwn(result.exports, "toast"));
});

test("scope start and limit lists use the plugins' descendant chains", () => {
  const result = scopeModule(
    "@scope (.wrap :global(.x, .y)) to (.foot :local(.a, .b)){.target{color:red}}",
    relative,
  );
  assert.equal(
    result.css,
    `@scope (.${prefix}wrap .x .y) to (.${prefix}foot .${prefix}a .${prefix}b){.${prefix}target{color:red}}`,
  );
  assert.deepEqual(Object.keys(result.exports).sort(), [
    "a",
    "b",
    "foot",
    "target",
    "wrap",
  ]);
});

test("prelude-only identities participate in collision checking", () => {
  const result = scopeModule("@scope (.button){.target{color:red}}", relative);
  const known = new Map<string, string>();
  recordModuleIdentities(result.identities, relative, known);
  assert.throws(
    () =>
      recordModuleIdentities(
        new Set([`${prefix}button`]),
        "entries/other.module.css",
        known,
      ),
    /CSS Modules generated name collision: .*_button in entries\/scope\.module\.css and entries\/other\.module\.css/,
  );
});

for (const nested of [
  "@media (min-width:1px){@scope (.toast) to (.footer){.x{color:red}}}",
  "@supports (display:grid){@scope (.toast) to (.footer){.x{color:red}}}",
  "@layer components{@scope (.toast) to (.footer){.x{color:red}}}",
  ".outer{@scope (.toast) to (.footer){.x{color:red}}}",
] as const)
  test(`scope prelude nested in ${nested.slice(0, 24)}`, () => {
    const result = scopeModule(nested, relative);
    assert.match(
      result.css,
      new RegExp(`@scope \\(\\.${prefix}toast\\) to \\(\\.${prefix}footer\\)`),
    );
    assert.equal(result.exports.toast, `${prefix}toast`);
  });

test("scope-suffixed custom at-rules are hidden and restored unchanged", () => {
  const result = scopeModule(
    "@myScope (.button) to (.footer){.x{color:red}}",
    relative,
  );
  assert.equal(
    result.css,
    `@myScope (.button) to (.footer){.${prefix}x{color:red}}`,
  );
  assert.deepEqual(Object.keys(result.exports), ["x"]);
});

test("a lost temporary selector is an internal failure, not guessed CSS", () => {
  const root = postcss.parse("@scope (.button){.target{color:red}}", {
    from: relative,
  });
  const restore = prepareModuleScopes(root, relative);
  root.first?.remove();
  assert.throws(restore, /temporary CSS scope selector was lost/);
});

test("malformed scope on a later line keeps the authored location", () => {
  assert.throws(
    () =>
      scopeModule(
        ".ok{color:red}\n@scope (.button) to {.x{color:red}}",
        relative,
      ),
    (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] CSS Modules @scope prelude is invalid in ${relative}:2:1; use an optional (start) and/or to (limit)`,
      );
      return true;
    },
  );
});
