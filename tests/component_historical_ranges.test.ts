import assert from "node:assert/strict";
import { test } from "node:test";

import { validateComponentRanges } from "../dist/components/ranges.js";
import type { ComponentRangeRecord } from "../packages/viewer/dist/components/manifest_types.js";

const records: readonly ComponentRangeRecord[] = [
  { id: "r-0", target: { kind: "instance", instanceKey: "instance" } },
];

for (const prefix of ["mokly", "mokabook"])
  test(`historical ${prefix} ranges retain original offsets and validation`, () => {
    const start = `<!--${prefix}-component:start:r-0-->`;
    const end = `<!--${prefix}-component:end:r-0-->`;
    const html = `<html><body>😀${start}<button>Action</button>${end}<style>.a{color:red}</style></body></html>`;
    const [range] = validateComponentRanges(html, records, "historical");
    assert.ok(range);
    assert.equal(range.start, html.indexOf(start));
    assert.equal(range.end, html.indexOf(end) + end.length);
    assert.equal(
      html.slice(range.contentStart, range.contentEnd),
      "<button>Action</button>",
    );
    assert.throws(
      () =>
        validateComponentRanges(html.replace(end, ""), records, "historical"),
      /missing component boundaries/,
    );
    assert.throws(
      () =>
        validateComponentRanges(
          html.replace(start, start.replace("r-0", "bad")),
          records,
          "historical",
        ),
      /malformed component boundary/,
    );
    assert.throws(
      () =>
        validateComponentRanges(
          `<!--${prefix}-review-ignore:start:bad-->${html}<!--${prefix}-review-ignore:end:bad-->`,
          records,
          "historical",
        ),
      /ReviewIgnore cannot enclose/,
    );
    if (prefix === "mokabook")
      assert.throws(
        () => validateComponentRanges(html, records),
        /missing component boundaries/,
      );
  });
