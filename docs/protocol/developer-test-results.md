# Selected Developer Test Results

Continuation of [Developer Test Commands](./developer-test-commands.md).

## Internal Evidence And Complete Reports

The Node reporter records per-file summaries, top-level file results, and every
failure's `details.error.failureType` in its temporary event data. A file result
is a top-level `test:pass` or `test:fail` whose name resolves to its `file`.

For selected runs, a file with a top-level pass but no per-file summary reported
no test results. Do not count it as observed or print a zero-test warning for it.
Complete and strict runs derive observed files only from per-file summaries.
They keep rejecting files with no summary, and report validation requires at
least one test per file. Selected runs now also reject files with no summary
when they have a top-level pass. The written report schema stays unchanged:
every failure entry is exactly `{ name, diagnostic }`. Internal
file results, failure types, classifications, and selected totals never enter it.

## Counts And Warnings

With readable, complete evidence, print the skipped and todo count first.
For each file explicitly named on the command line with a per-file summary
that reports zero tests,
print this stdout line in selected-file order:

```text
warning: no test ran in <file>
```

Append `; check --test-name-pattern` if the invocation includes a pattern.
Skipped and todo tests count as reported tests for warning decisions.
An empty `describe` or a pattern that matches no tests can report a zero-test
summary. These files warn and pass.

A pattern-only invocation prints no per-file warning. Print the following line
only when at least one selected file reported results and none of those files
reported any test:

```text
warning: no test matched --test-name-pattern
```

Then print the selected scope and executed count:

```text
selected files: <files>; tests run: <n>; partial verification; complete gate: cargo xtask check
```

`<n>` sums per-file `passed + failed + cancelled`; skips and todos do not add
to it. File-only results add zero. Use file counts because Node's run-level
output can count a file-only result as one passed test. A zero-test summary
still passes.

## Failure And Cancellation Groups

Ignore `subtestsFailed` wrapper names in the selected report. Put
`testTimeoutFailure` and `cancelledByParent` names in the cancelled group.
Put every other failure type, including `hookFailed` and load failures, in the
failed group. Keep the reporter order within each group.

If either group has names or its per-file count is non-zero, fail the run with
an expected report. Print the failed group first, then the cancelled group.
Print both if both exist. Each header uses its name count when non-empty;
otherwise use the per-file count and print the header alone. Use singular
`test` only for one, and `tests` for every other count:

```text
<n> selected unit test(s) failed:
✖ <name>
<m> selected unit test(s) cancelled:
✖ <name>
```

Show at most 20 names per group. Append `… and <k> more` for that group's
remaining names. Counts or names can never be suppressed into success.

## Files With No Test Results

A selected file with a top-level pass but no per-file summary fails the run
with an expected failure. Print this exact message for one file:

```text
1 selected unit test file reported no test results:
✖ tests/cli.test.ts
Possible causes: the file registers no tests, or a test ended the process early (for example with process.exit).
```

Use the total file count in the header. Use `files` when the count is not one.
List at most 20 names in selected-file order. Append `… and <k> more` for the
remaining names before the possible-causes line. This includes empty modules,
platform-guarded files that register no tests, and early process exits.

## Process And Internal Errors

When the process exits with a signal or non-zero code and reporter output is
missing or incomplete, report the process first as an expected failure:

```text
selected unit test process exited with signal <signal>; the test reporter did not finish
selected unit test process exited with code <code>; the test reporter did not finish
```

Do not print warnings, skipped/todo counts, or `tests run` from unreadable
evidence. Preserve its internal error and stack when the process exits 0.
Other invalid evidence remains an internal fault regardless of process status.

With complete evidence, check the evidence error, reporter completion, both
failure groups, process outcome, files with no test results, and the internal
file-set check in that order. A remaining
process failure prints `selected unit test process exited with signal <signal>`
or `selected unit test process exited with code <code>` without the suffix.
Files missing both a summary and a top-level file result, and unexpected
observed files, remain an internal fault. Name both sets in the error.
Expected failures exit 1 with their message only on stderr.
Internal faults retain Node's default stack report. Temporary output is removed
on all outcomes, including a real signal interruption.
