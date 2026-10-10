import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

for (const mode of ["committed", "derived"] as const)
  for (const [name, before, after] of [
    [
      "excluded cumulative rule",
      "<style>.action{color:red}</style>",
      "<style>.action{color:red}.unused{color:blue}</style>",
    ],
    [
      "owned component rule",
      "<style>.actual-only{color:red}</style>",
      "<style>.actual-only{color:blue}</style>",
    ],
    [
      "formatting-only rule",
      "<style>.action { color: red; }</style>",
      "<style>/* format */.action{color:red}</style>",
    ],
  ] as const)
    test(`${mode} fast and complete comparisons agree for an inline ${name}`, async (t) => {
      const fixture = await inlineChangesFixture(t, "", "", {
        renderer: {
          before: scopedRenderer(before),
          after: scopedRenderer(after),
        },
      });
      const events: TimingEvent[] = [];
      const fast = await runWithTimings(
        true,
        "test",
        () => fixture.complete(true, mode),
        { write: (event) => events.push(event) },
      );
      const complete = await fixture.complete(false, mode);
      const counts = events.find(
        (event) =>
          event.stage === "review.compare-screens" && event.event === "counts",
      )?.counts;
      assert.ok(Number(counts?.fastPath) > 0);
      assert.deepEqual(fast.result, complete.result);
    });

function scopedRenderer(styles: string): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>' + (input.entry.path === "home" ? ${JSON.stringify(styles)} : '<style>.stable{color:black}</style>') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
}
