import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import type { CssRuleParser } from "../packages/mokly/src/review/css/types.js";

import { analyze, documents, excluded, kept } from "./helpers/review_css.js";

test("CSS adapter matches the existing parse5 default tree shape", () => {
  const pair =
    documents(`<!doctype html><main id="panel" lang="en"><!-- comment -->
    <button class="button primary" data-state="Ready">Save &amp; continue</button>
    text <button class="button" disabled>Cancel</button><svg><linearGradient id="paint"/></svg>
  </main>`);
  for (const selector of [
    "#panel > button.primary[data-state=ready i]",
    "main button:first-child",
    "button + button:disabled",
    "button:nth-child(2)",
    "button:nth-last-child(2)",
    "main:has(> button.primary)",
    "button:lang(en)",
    "linearGradient#paint",
  ])
    assert.equal(
      analyze("", `${selector}{color:red}`, pair).kind,
      "kept",
      selector,
    );
  for (const selector of [
    "button:nth-child(4)",
    "button.primary + img",
    "main:has(.absent)",
  ])
    assert.deepEqual(analyze("", `${selector}{color:red}`, pair), excluded);
});

test("CSS adapter respects document quirks and does not traverse inert templates", () => {
  assert.deepEqual(
    analyze("", ".BUTTON{color:red}", {
      after: parse('<button class="button">Save</button>'),
    }),
    kept("matched", ".BUTTON"),
  );
  assert.deepEqual(analyze("", ".BUTTON{color:red}", documents()), excluded);
  assert.deepEqual(
    analyze(
      "",
      ".inside{color:red}",
      documents(
        '<!doctype html><template><div class="inside"></div></template>',
      ),
    ),
    excluded,
  );
});

for (const selector of [
  ".button:hover",
  ".button:focus",
  ".button:focus-visible",
  ".button:focus-within",
  ".button:active",
  ".button:visited",
  ".button::before",
  ".button:after",
  ".button::placeholder",
  ".button:target",
  ".button:popover-open",
]) {
  test(`CSS match tests the base compound for ${selector}`, () => {
    const result = analyze("", `${selector}{color:red}`);
    assert.ok(result.kind === "kept");
    assert.equal(result.status, "matched");
    assert.deepEqual(
      analyze("", `${selector.replace("button", "unused")}{color:red}`),
      excluded,
    );
  });
}

test("CSS pseudo stripping preserves compounds, combinators, and literal strings", () => {
  const pair = documents(
    '<!doctype html><div class="button"><span class="child"></span></div>',
  );
  for (const selector of [
    ".button:hover > .child::before",
    ".button :focus",
    ".button:is(:hover, .absent)",
  ])
    assert.equal(analyze("", `${selector}{color:red}`, pair).kind, "kept");
  for (const selector of [
    ".button:hover + .child",
    '.button[data-state="a:hover"]',
    String.raw`.button\:hover`,
    ".button:focus .absent",
  ])
    assert.deepEqual(analyze("", `${selector}{color:red}`, pair), excluded);
});

test("CSS pseudo stripping preserves possible matches through negation", () => {
  for (const selector of [
    ".button:not(:hover)",
    ".button:not(.button:hover)",
    ".button:not(:not(:hover))",
    ".button:not(:is(.absent, :hover))",
    ".button:not(:has(.child:focus))",
  ])
    assert.deepEqual(
      analyze("", `${selector}{color:red}`),
      kept("matched", selector),
    );
  assert.deepEqual(
    analyze("", ".button:not(:is(.button, :hover)){color:red}"),
    excluded,
  );
});

test("CSS static structural selectors and nested state-dependent counts remain distinct", () => {
  const pair = documents(
    '<!doctype html><ul><li class="row">One</li><li class="row">Two</li></ul>',
  );
  assert.deepEqual(analyze("", ".row:nth-child(8){color:red}", pair), excluded);
  assert.deepEqual(
    analyze("", ".row:nth-child(1 of :hover){color:red}", pair),
    kept("matched", ".row:nth-child(1 of :hover)"),
  );
});

test("CSS nesting combines parents before testing a changed child", () => {
  const before = ".outer{.child{color:red}}";
  const after = ".outer{.child{color:blue}}";
  assert.deepEqual(
    analyze(
      before,
      after,
      documents('<!doctype html><div class="child"></div>'),
    ),
    excluded,
  );
  assert.deepEqual(
    analyze(
      before,
      after,
      documents(
        '<!doctype html><div class="outer"></div><div class="child"></div>',
      ),
    ),
    excluded,
  );
  assert.deepEqual(
    analyze(
      before,
      after,
      documents(
        '<!doctype html><div class="outer"><span class="child"></span></div>',
      ),
    ),
    kept("matched", "& .child"),
  );
});

test("CSS nesting handles selector lists, multiple levels, and repeated ampersands", () => {
  const pair = documents(
    '<!doctype html><section class="outer"><div class="middle"><span class="child"></span><span class="child"></span></div></section>',
  );
  for (const [before, after, selector] of [
    [
      ".absent,.outer{.child{color:red}}",
      ".absent,.outer{.child{color:blue}}",
      "& .child",
    ],
    [
      ".outer{.middle{&>.child{color:red}}}",
      ".outer{.middle{&>.child{color:blue}}}",
      "& > .child",
    ],
    [
      ".outer .child{&+&{color:red}}",
      ".outer .child{&+&{color:blue}}",
      "& + &",
    ],
    [
      ".outer{@media print{.child{color:red}}}",
      ".outer{@media print{.child{color:blue}}}",
      "& .child",
    ],
  ] as const)
    assert.deepEqual(analyze(before, after, pair), kept("matched", selector));
});

test("CSS nesting keeps unresolvable combinations and shadow or global parents", () => {
  for (const prelude of ["&", ":host", "body", "*"]) {
    const parser: CssRuleParser = {
      parse: (source) => ({
        status: "parsed",
        rules: source
          ? [
              {
                ordinal: 0,
                selectors: ["& .unused"],
                declarations: "color:red",
                hasCustomProperties: false,
                conditions: [{ kind: "nesting-parent", prelude }],
              },
            ]
          : [],
      }),
    };
    assert.deepEqual(
      analyze("", "fixture", documents(), parser),
      kept("unresolved", "& .unused"),
    );
  }
});
