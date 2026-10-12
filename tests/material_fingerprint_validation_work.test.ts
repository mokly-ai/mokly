import assert from "node:assert/strict";
import test from "node:test";

import { reviewIgnoreRegions } from "../dist/review/ignore.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

const materialPattern = "<!--mokly-review-material:[\\s\\S]*?-->";
const region =
  "<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->";
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;

test("regions-only window validation does not build a signal inventory", (context) => {
  const source = `<style>.entry{color:red}</style>${region}${signal}`;
  let scans = 0;
  const matchAll = String.prototype.matchAll;
  context.mock.method(
    String.prototype,
    "matchAll",
    function (this: string, pattern: RegExp) {
      if (String(this) === source && pattern.source === materialPattern)
        scans++;
      return matchAll.call(this, pattern);
    },
  );
  assert.equal(reviewIgnoreRegions(source, "test").length, 1);
  assert.equal(scans, 1, "only the eager validator reads signal matches");
});

for (const signals of [false, true])
  test(`lazy inventories reuse validated presence and ids, signals=${signals}`, (context) => {
    const source = `<style>.entry{color:red}</style>${region}${signals ? signal : ""}`;
    let scans = 0;
    const matchAll = String.prototype.matchAll;
    context.mock.method(
      String.prototype,
      "matchAll",
      function (this: string, pattern: RegExp) {
        if (String(this) === source && pattern.source === materialPattern)
          scans++;
        return matchAll.call(this, pattern);
      },
    );
    const page = new PageAnalysis(source, "test");
    assert.equal(scans, 1);
    assert.deepEqual([...page.materialIds], signals ? ["clock"] : []);
    assert.equal(scans, 1, "membership uses the already validated keys");
    assert.equal(page.materialSignals.length, signals ? 1 : 0);
    assert.equal(
      scans,
      signals ? 2 : 1,
      "absent signals require no second source scan",
    );
    assert.strictEqual(page.materialSignals, page.materialSignals);
    assert.strictEqual(page.materialIds, page.materialIds);
    assert.equal(scans, signals ? 2 : 1);
  });
