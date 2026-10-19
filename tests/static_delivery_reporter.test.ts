import assert from "node:assert/strict";
import test from "node:test";

import StaticDeliveryReporter from "../scripts/verification/static-delivery-reporter.js";

test("delivery evidence requires each assigned test to pass exactly once", async () => {
  for (const observed of [
    [
      { id: "a", status: "passed" },
      { id: "b", status: "passed" },
    ],
    [{ id: "a", status: "passed" }],
    [
      { id: "a", status: "passed" },
      { id: "a", status: "passed" },
    ],
    [
      { id: "a", status: "passed" },
      { id: "other", status: "passed" },
    ],
    [
      { id: "a", status: "passed" },
      { id: "b", status: "skipped" },
    ],
    [
      { id: "a", status: "passed" },
      { id: "b", status: "failed" },
    ],
    [
      { id: "a", status: "passed" },
      { id: "b", status: "timedOut" },
    ],
    [
      { id: "a", status: "passed" },
      { id: "b", status: "interrupted" },
    ],
  ] as const) {
    const saved: string[] = [];
    const reporter = new StaticDeliveryReporter(
      { outputFile: "report.json" },
      async (_file, text) => {
        saved.push(text);
      },
    );
    reporter.onBegin({}, { allTests: () => [{ id: "a" }, { id: "b" }] });
    for (const result of observed) reporter.onTestEnd(result, result);
    const expected =
      observed.length === 2 &&
      observed[1].id === "b" &&
      observed[1].status === "passed"
        ? "passed"
        : "failed";
    assert.deepEqual(await reporter.onEnd({ status: "passed" }), {
      status: expected,
    });
    assert.equal(saved.length, 1);
    assert.deepEqual(JSON.parse(saved[0]!), {
      scope: "static-delivery",
      status: expected,
      expected: ["a", "b"],
      observed,
      errors: [],
    });
  }
});

test("delivery evidence rejects empty discovery, reporter errors and failed runs", async () => {
  for (const failure of ["empty", "error", "process", "duplicate"]) {
    const reporter = new StaticDeliveryReporter(
      { outputFile: "report.json" },
      async () => {},
    );
    const tests =
      failure === "empty"
        ? []
        : failure === "duplicate"
          ? [{ id: "a" }, { id: "a" }]
          : [{ id: "a" }];
    reporter.onBegin({}, { allTests: () => tests });
    for (const entry of tests) reporter.onTestEnd(entry, { status: "passed" });
    if (failure === "error") reporter.onError({ message: "setup failed" });
    assert.deepEqual(
      await reporter.onEnd({
        status: failure === "process" ? "failed" : "passed",
      }),
      { status: "failed" },
    );
  }
});
