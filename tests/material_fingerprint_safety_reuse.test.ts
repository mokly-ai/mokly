import assert from "node:assert/strict";
import test from "node:test";

import { runWithComparisonWork } from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const style = '<style>.entry{color:red;content:"mokly"}</style>';
const region = (value: string) =>
  `<!--mokly-review-ignore:start:clock-->${value}<!--mokly-review-ignore:end:clock-->`;

for (const mode of ["committed", "derived"] as const)
  for (const changedIgnore of [false, true])
    test(`${mode} source-safety proof reuse after ${changedIgnore ? "non-identical" : "identical"} quick-check fall-through`, async (context) => {
      const head = (text: string) =>
        `<link rel="stylesheet" href="../shared.css">${style}${region(text)}`;
      const fixture = await inlineChangesFixture(context, "", "", {
        colorSchemes: false,
        renderer: {
          before: fingerprintRenderer(head("same")),
          after: fingerprintRenderer(head(changedIgnore ? "later" : "same")),
        },
        files: {
          before: {
            "shared.css": ".missing{color:red}",
            "action/shared.css": ".missing{color:red}",
            "pane/shared.css": ".missing{color:red}",
          },
          after: {
            "shared.css": ".missing{color:blue}",
            "action/shared.css": ".missing{color:blue}",
            "pane/shared.css": ".missing{color:blue}",
          },
        },
      });
      const input = await pageFixtureInput(fixture, mode);
      const oracle = await fingerprintComparison(input, false);
      assert.equal(oracle.kind, "result");
      for (const useFastPath of [true, false])
        for (const useStylePath of [true, false])
          await context.test(
            `fast=${useFastPath}, style=${useStylePath}`,
            async (test) => {
              let scans = 0;
              let proofs = 0;
              const remember = PageAnalysisPair.prototype.rememberStyleSafety;
              test.mock.method(
                PageAnalysisPair.prototype,
                "rememberStyleSafety",
                function (
                  this: PageAnalysisPair,
                  spans: Parameters<PageAnalysisPair["rememberStyleSafety"]>[0],
                ) {
                  proofs++;
                  return remember.call(this, spans);
                },
              );
              const includes = String.prototype.includes;
              test.mock.method(
                String.prototype,
                "includes",
                function (this: string, needle: string, start?: number) {
                  if (String(this) === style && needle === "<!--mokly-review-")
                    scans++;
                  return includes.call(this, needle, start);
                },
              );
              const events: TimingEvent[] = [];
              const current = await runWithTimings(
                true,
                "test",
                () =>
                  runWithComparisonWork(
                    () =>
                      fingerprintComparison(input, true, "home", undefined, {
                        useFastPath,
                        useStylePath,
                      }),
                    true,
                  ),
                { write: (event) => events.push(event) },
              );
              assert.deepEqual(current, oracle);
              assert.equal(current.kind, "result");
              if (current.kind !== "result") return;
              assert.equal(current.result.comparisonPath, "complete");
              const work = events.find(
                ({ stage, event }) =>
                  stage === "review.material-work" && event === "counts",
              )!.counts!;
              assert.equal(work.fingerprintedViews, 1);
              assert.equal(proofs, useFastPath && useStylePath ? 1 : 0);
              const quickScans = useFastPath ? (changedIgnore ? 2 : 1) : 0;
              assert.equal(
                scans,
                quickScans + (useFastPath && useStylePath ? 0 : 2),
                "only a successful proof with both switches enabled replaces the complete guard",
              );
            },
          );
    });
