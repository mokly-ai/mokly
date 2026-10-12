import assert from "node:assert/strict";
import test from "node:test";

import { createElementOwnerIndex } from "../src/review/css/element_owners.js";
import { findUnownedInlineStyles } from "../src/review/css/inline_styles.js";
import { PageAnalysis } from "../src/review/page_analysis.js";

import { html, markedRange, range, view } from "./helpers/inline_styles.js";

const usage = {
  ...view({ ranges: [range(0, { kind: "root" })] }),
  resources: [],
  insertedStylesheets: [],
};
const open = "<!--mokly-review-ignore:start:dynamic-->";
const close = "<!--mokly-review-ignore:end:dynamic-->";

for (const [name, body] of [
  [
    "both",
    open + markedRange(0, '<button class="action">Ignored</button>') + close,
  ],
  [
    "start",
    open +
      "<!--mokly-component:start:r-0-->" +
      close +
      '<button class="action">Kept</button><!--mokly-component:end:r-0-->',
  ],
  [
    "end",
    '<!--mokly-component:start:r-0--><button class="action">Kept</button>' +
      open +
      "<!--mokly-component:end:r-0-->" +
      close,
  ],
])
  test(`original page analysis permits ${name} root boundaries inside paired ignores`, () => {
    const source = html("<style>.action{color:red}</style>", body!);
    const page = new PageAnalysis(source, "action/index.mobile.html", usage);
    assert.equal(page.ranges.length, 1);
    assert.equal(page.inlineStyles(["dynamic"]).length, 1);
    const owners = createElementOwnerIndex({
      ranges: page.ranges,
      usage,
      counterpart: usage,
      rootComponentId: "action",
    });
    assert.deepEqual(owners.ownerAt(source.indexOf("<button")), {
      kind: "entry",
    });
  });

test("inline styles within the saved root remain entry material", () => {
  const source = html(
    "",
    markedRange(
      0,
      '<style>.action{color:red}</style><button class="action">Action</button>',
    ),
  );
  const page = new PageAnalysis(source, "action/index.mobile.html", usage);
  assert.equal(page.inlineStyles([]).length, 1);
  assert.equal(
    findUnownedInlineStyles(source, page.ranges, new Set()).length,
    1,
  );
});
