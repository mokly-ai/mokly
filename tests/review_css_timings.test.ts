import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  runWithTimings,
  timeSync,
  type TimingEvent,
} from "../packages/mokly/src/diagnostics/timings.js";
import { analyzeStylesheetChange } from "../packages/mokly/src/review/css/analyze.js";
import type { CssRuleParser } from "../packages/mokly/src/review/css/types.js";

for (const after of [
  ".private-selector { color: red; }",
  ".unrelated-private-selector { color: red; }",
  ".private-selector { color: red;",
  "",
]) {
  test(`CSS diagnostics preserve the outcome for ${JSON.stringify(after)}`, () => {
    const documents = {
      after: parse(
        '<!doctype html><p class="private-selector">Private text</p>',
      ),
    };
    const events: TimingEvent[] = [];
    let clock = 0;
    const operation = () => analyzeStylesheetChange("", after, documents);
    const normal = runWithTimings(false, "test", operation, {
      write: (event) => events.push(event),
    });
    assert.equal(events.length, 0);
    const timed = runWithTimings(
      true,
      "test",
      () => timeSync("review.compare-screens", operation),
      { clock: () => clock++, write: (event) => events.push(event) },
    );
    assert.deepEqual(timed, normal);
    const css = events.filter((event) => event.stage === "review.css-analysis");
    assert.equal(css.length, 2);
    assert.deepEqual(
      css.map((event) => event.event),
      ["start", "end"],
    );
    const parent = events.find(
      (event) => event.stage === "review.compare-screens",
    )!;
    for (const event of css) {
      assert.equal(event.parentId, parent.id);
      assert.equal(event.session, parent.session);
      assert.equal(event.role, "test");
    }
    assert.equal(css[0]!.id, css[1]!.id);
    assert.equal(css[1]!.status, "ok");
    assert.ok(css[1]!.durationMs! >= 0);
    assert.doesNotMatch(JSON.stringify(events), /private|Private|color/);
  });
}

test("CSS diagnostics keep parser failures unresolved without logging their content", () => {
  const failure = new Error("private parser error");
  const parser: CssRuleParser = {
    parse: () => {
      throw failure;
    },
  };
  const events: TimingEvent[] = [];
  const outcome = runWithTimings(
    true,
    "test",
    () => analyzeStylesheetChange("", "", {}, parser),
    { write: (event) => events.push(event) },
  );
  assert.deepEqual(outcome, {
    kind: "kept",
    status: "unresolved",
    selectors: [],
  });
  assert.equal(events.length, 2);
  assert.equal(events.at(-1)?.stage, "review.css-analysis");
  assert.equal(events.at(-1)?.event, "end");
  assert.equal(events.at(-1)?.status, "ok");
  assert.doesNotMatch(JSON.stringify(events), /private parser error/);
});
