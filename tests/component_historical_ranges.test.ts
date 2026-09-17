import assert from "node:assert/strict";
import { test } from "node:test";

import { validateComponentRanges } from "../dist/components/ranges.js";
import type { ComponentRangeRecord } from "../packages/viewer/dist/components/manifest_types.js";

const records: readonly ComponentRangeRecord[] = [
  { id: "r-0", target: { kind: "instance", instanceKey: "instance" } },
];

test("historical ranges retain original offsets and validation", () => {
  const start = "<!--mokly-component:start:r-0-->";
  const end = "<!--mokly-component:end:r-0-->";
  const html = `<html><body>😀${start}<button>Action</button>${end}<style>.a{color:red}</style></body></html>`;
  const [range] = validateComponentRanges(html, records);
  assert.ok(range);
  assert.equal(range.start, html.indexOf(start));
  assert.equal(range.end, html.indexOf(end) + end.length);
  assert.equal(
    html.slice(range.contentStart, range.contentEnd),
    "<button>Action</button>",
  );
  assert.throws(
    () => validateComponentRanges(html.replace(end, ""), records),
    /missing component boundaries/,
  );
  assert.throws(
    () =>
      validateComponentRanges(
        html.replace(start, start.replace("r-0", "bad")),
        records,
      ),
    /malformed component boundary/,
  );
  assert.throws(
    () =>
      validateComponentRanges(
        `<!--mokly-review-ignore:start:bad-->${html}<!--mokly-review-ignore:end:bad-->`,
        records,
      ),
    /ReviewIgnore cannot enclose/,
  );
});
