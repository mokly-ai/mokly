# CI Duration Budgets

Every run of the CI workflow reports how long each job ran against its
budget. The report also shows the critical path and the slowest tests. It
exists to keep CI fast as jobs, shards, and tests change. The budgets apply to
CI jobs and to the wall clock of a run. They never apply to one test: test
durations stay report text under the
[CI test timing contract](./ci-test-timing.md#duration-reporting).

## Report Job

The `CI timing` job of `.github/workflows/ci.yml` runs the report. It runs
after every other job of the run, with `if: always()`, so it also reports
runs in which a job failed. `Required CI` does not need it, so the report
never delays or gates the branch-rule status.

The job reads job and step times from the GitHub API with the run's own
token. It is the only CI job with `actions: read`. It keeps `contents: read`
and gets no secret. It needs no npm dependencies and no Rust build. Its
10-minute timeout is a hang guard under the
[job timeout rule](./ci-workflow.md#job-execution).

## Budget File

`scripts/verification/ci-budgets.json` holds the budgets. It has these
fields:

| Field              | Meaning                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `mode`             | `warn` or `fail`, as [Warnings And The Failing Mode](#warnings-and-the-failing-mode) says. |
| `wallClockMinutes` | The budget of the wall clock of a first attempt.                                           |
| `slowestTests`     | The number of rows in each slowest-test table.                                             |
| `jobs`             | An ordered list of `pattern` and `minutes` pairs.                                          |

A pattern matches the whole job name. In a pattern, `*` matches any run of
characters, also an empty one. Every other character matches only itself,
and case counts. The first pattern that matches a job name sets its budget.
A pattern such as `Browser *` therefore covers every browser shard, and a new
shard needs no budget edit. A job that ran and that no pattern matches shows
`no budget` in the summary and adds a warning.

The current targets are no job above about 12 minutes and a wall clock of
about 12 minutes. The initial values of the budget file come from these
targets and are values to tune as the measured times change.

## Measured Times

- The run time of a job is the time from its start to its completion. Queue
  time is not part of it.
- A skipped job, or a job that never started, has no budget check.
- A job that is still running when the report reads the jobs adds a warning
  and has no run time. The report job leaves itself out.
- The wall clock of an attempt is the time from the creation of its first job
  to the completion of its last job.
- The critical path is the chain of jobs that sets the wall clock. GitHub
  creates a job when the last job that it needs completes. The blocking job
  of a job is therefore the job that completed last at or before that
  creation. A skipped job never blocks another job on the path. For each job
  on the path, the summary gives its wait, its run time, and its end time
  from the start of the attempt.

The report infers the critical path from the job times. Reading the `needs`
graph from the workflow file was rejected, because it needs a YAML parser and
so an npm install in the report job. The times give the same chain.

## Reruns

A rerun of failed jobs starts a new attempt. The API lists every job under
the new attempt, and the jobs that did not run again keep the times of their
earlier attempt. The report marks these jobs as reused from an earlier
attempt and keeps their run times and budget checks. The wall clock and the
critical path cover only the jobs that ran in the new attempt. The wall-clock
budget applies only to a first attempt. A complete rerun is a first attempt
of all jobs again, so every check applies.

## Job Summary

The report writes these parts to the job summary, in this order:

1. The mode.
2. The wall clock of the attempt and, for a first attempt, its budget.
3. The critical path.
4. A table of every completed job, the longest first: result, run time,
   budget and its pattern, status, and slowest step.
5. The slowest tests of the `verification-*` reports of the run. A report
   that times each test, such as a browser shard report, adds rows of tests.
   Another report, such as the viewer report, adds rows of test files.
6. Notes: each warning that is not about a budget.

Job and test names in the summary and in annotations are escaped. A name
cannot add a workflow command, a table cell, or HTML.

## Warnings And The Failing Mode

The `mode` field is the one setting that turns the report into a failing
check.

In `warn` mode, each job above its budget, each job without a budget, a wall
clock above its budget, and each note adds one warning annotation. The step
always succeeds, also when the API or the budget file cannot be read.

In `fail` mode, each job above its budget and a wall clock above its budget
add an error annotation, and the step fails. A report that cannot run also
fails the step. A job without a budget and a note stay warnings.

GitHub shows at most 10 annotations of each level for one step. When a level
has more, its tenth annotation gives the number of the others, and the job
summary lists all of them.

The budget file is in `warn` mode. A failing check needs the user's approval,
because a new failing gate needs it. Even in `fail` mode, the job stays
outside `Required CI`, so a failure blocks a merge only after the branch rule
or `Required CI` requires it.

## Related Docs

- [CI workflow graph](./ci-workflow.md)
- [CI test timing](./ci-test-timing.md)
- [CI suite evidence](./ci-suite-evidence.md)
- [Protocol index](./README.md)
