import assert from "node:assert/strict";
import test from "node:test";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { PlainServeReporter } from "../dist/server/reporter.js";

import { memoryTerminal } from "./helpers/terminal.js";

test("plain earlier-baseline notices use stdout while warnings and errors retain stderr", () => {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  reporter.incompatibleBaseline("a".repeat(40));
  reporter.incompatibleBaseline("a".repeat(40));
  reporter.warning("warning");
  reporter.diagnostic("stack details");
  reporter.runtimeDiagnostic(new Error("runtime failure"));
  assert.equal(terminal.stdout(), `${EARLIER_BASELINE_MESSAGE}\n`);
  assert.equal(terminal.stderr(), "warning\nstack details\nruntime failure\n");
});

for (const mode of ["plain", "rich"] as const) {
  test(`${mode} earlier notices reset after accepting a different successful base`, () => {
    const terminal = memoryTerminal({ isTTY: mode === "rich" });
    const reporter =
      mode === "plain"
        ? new PlainReporter(terminal.environment)
        : new RichReporter(terminal.environment);
    reporter.incompatibleBaseline("a".repeat(40));
    reporter.incompatibleBaseline("a".repeat(40));
    reporter.baselineReady("b".repeat(40), true, 0);
    reporter.incompatibleBaseline("a".repeat(40));
    reporter.incompatibleBaseline("a".repeat(40));
    assert.equal(
      (terminal.stdout() + terminal.stderr()).split(EARLIER_BASELINE_MESSAGE)
        .length - 1,
      2,
    );
    reporter.close();
  });
}

test("the default plain Serve reporter separates successful notices from failures", () => {
  const errors: string[] = [],
    notices: string[] = [];
  const reporter = new PlainServeReporter(
    (value) => errors.push(value),
    (value) => notices.push(value),
  );
  reporter.incompatibleBaseline("a".repeat(40));
  reporter.incompatibleBaseline("a".repeat(40));
  reporter.baselineReady("b".repeat(40), false, 0);
  reporter.incompatibleBaseline("a".repeat(40));
  reporter.runtimeDiagnostic(new Error("failure"));
  assert.deepEqual(notices, [
    `${EARLIER_BASELINE_MESSAGE}\n`,
    `${EARLIER_BASELINE_MESSAGE}\n`,
  ]);
  assert.deepEqual(errors, ["failure\n"]);
});
