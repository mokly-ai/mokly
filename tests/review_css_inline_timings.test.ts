import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithTimings,
  timeSync,
  type TimingEvent,
} from "../src/diagnostics/timings.js";
import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import type {
  CssRuleParser,
  CssRuleParseResult,
} from "../src/review/css/types.js";

import { html, inlineInput } from "./helpers/inline_styles.js";

test("inline diagnostics preserve results without logging document or CSS data", () => {
  const input = inlineInput({
    before: html(
      "<style>.private-selector{color:red}</style>",
      '<p class="private-selector">Private text</p>',
    ),
    after: html(
      "<style>.private-selector{color:blue}</style>",
      '<p class="private-selector">Private text</p>',
    ),
  });
  const events: TimingEvent[] = [];
  let clock = 0;
  const operation = () => attributeInlineRules(input);
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
  const inline = events.filter(
    (event) => event.stage === "review.inline-style-analysis",
  );
  assert.deepEqual(
    inline.map(({ event }) => event),
    ["start", "end"],
  );
  assert.equal(inline[1]?.status, "ok");
  const parent = events.find(
    (event) => event.stage === "review.compare-screens",
  );
  assert.ok(parent);
  assert.ok(inline.every((event) => event.parentId === parent.id));
  assert.doesNotMatch(
    JSON.stringify(events),
    /private-selector|Private text|color/,
  );
});

test("contained inline parser failures end the timing span successfully", () => {
  const parser: CssRuleParser = {
    parse: () => {
      throw new Error("private parser failure");
    },
  };
  const events: TimingEvent[] = [];
  const result = runWithTimings(
    true,
    "test",
    () =>
      attributeInlineRules(
        inlineInput({
          before: html("", ""),
          after: html("<style>private css</style>", ""),
          parser,
        }),
      ),
    { write: (event) => events.push(event) },
  );
  assert.equal(result.status, "unresolved");
  assert.equal(events.at(-1)?.stage, "review.inline-style-analysis");
  assert.equal(events.at(-1)?.status, "ok");
  assert.doesNotMatch(
    JSON.stringify(events),
    /private parser failure|private css/,
  );
});

test("identical outer sources still time discovery before skipping", () => {
  const source = html("<style>.same{color:red}</style>", "");
  const events: TimingEvent[] = [];
  const result = runWithTimings(
    true,
    "test",
    () => attributeInlineRules(inlineInput({ before: source, after: source })),
    { write: (event) => events.push(event) },
  );
  assert.equal(result.status, "skipped");
  assert.deepEqual(
    events.map(({ event, stage, status }) => [event, stage, status]),
    [
      ["start", "review.inline-style-analysis", undefined],
      ["end", "review.inline-style-analysis", "ok"],
    ],
  );
});

test("escaping inline failures end the timing span with error", () => {
  let calls = 0;
  const failure = new Error("private escaping failure");
  const parser: CssRuleParser = {
    parse: () => {
      calls += 1;
      if (calls === 1) return { status: "parsed", rules: [] };
      return Object.defineProperty({ status: "parsed" }, "rules", {
        get() {
          throw failure;
        },
      }) as CssRuleParseResult;
    },
  };
  const events: TimingEvent[] = [];
  assert.throws(
    () =>
      runWithTimings(
        true,
        "test",
        () =>
          attributeInlineRules(
            inlineInput({
              before: html("<style>before</style>", ""),
              after: html("<style>after</style>", ""),
              parser,
            }),
          ),
        { write: (event) => events.push(event) },
      ),
    (error) => error === failure,
  );
  assert.equal(events.at(-1)?.stage, "review.inline-style-analysis");
  assert.equal(events.at(-1)?.status, "error");
  assert.doesNotMatch(JSON.stringify(events), /private escaping failure/);
});
