# Targeted Developer Test Runs

Status: Active

Agents follow the rule "run relevant tests, then run `cargo xtask check`". The
public `npm test` command accepts only `--shard`, so `npm test -- <file>` fails
with a usage error and agents fall back to the complete unit suite. They then
run the complete browser suite, and `cargo xtask check` runs both suites again.
In the measured work, test gates took 39 of 72 implementer hours, about 20 of
those hours were duplicate runs, and the cheap repository ratchets failed only
after 40–65 minutes of earlier test runs. This plan gives the developer runner a
file and test-name selection contract, adds `test:unit` as the named complete
unit command, removes `--shard` from the developer runner, and rewrites the
agent rules so targeted runs happen during development and the complete gate
runs once.

## Base And Prerequisites

This plan is based on `origin/main` at `80ceb44`. The developer runner is
`scripts/verification/run-unit-dev.mjs`, which calls `runUnitVerification` in
`scripts/verification/unit-runner.mjs`. The strict runner
`scripts/verification/run-unit.mjs` backs `test:prepared`, which
`cargo xtask check` calls with an optional `--shard`. Argument parsing lives in
`scripts/verification/evidence.mjs`, whose `parseShardArgument` rejects every
argument except `--shard INDEX/TOTAL`. `tests/verification_entrypoints.test.ts`
pins the exact `test` and `test:prepared` script strings;
`tests/verification_wrapper.test.ts` runs the wrappers in a fixture repository;
`tests/verification_evidence.test.ts` covers shard parsing and report
validation. `CLAUDE.md` is a symlink to `AGENTS.md`, so only `AGENTS.md`
changes. `docs/protocol/ci-verification.md` is at 247 of its 250-line cap, so
the new command contract needs its own protocol page.

## Contract

Public scripts in `package.json`:

- `test:unit` prepares package and example output, then runs the developer
  runner. With no arguments it runs the complete discovered unit inventory with
  the current developer skip policy and writes the same evidence report as
  today.
- `test` forwards its arguments to `test:unit`, using the same `npm run ... --`
  pattern that `package:check` already uses, so `npm test -- <file>` works.
- `test:browser` is unchanged. It forwards to Playwright, so
  `npm run test:browser -- tests/browser/x.spec.ts -g "title"` runs one spec or
  one test. After one build, `npx playwright test ...` runs the same selection
  without rebuilding.
- `test:prepared`, `test:browser:prepared`, and `test:hydration:prepared` keep
  their shard-only argument contract. Only the strict runners accept `--shard`.

Developer runner arguments (`npm test -- ...` and `npm run test:unit -- ...`):

- Zero or more test file paths, relative to the repository root. Each path must
  resolve to a file in the discovered unit inventory (`.test.ts` or `.test.tsx`
  under `tests/` or `packages/viewer/tests/`). Any other path fails before any
  test runs and names the file; a `.spec.ts` path also names the browser
  command.
- Zero or more `--test-name-pattern=<regex>` or `--test-name-pattern <regex>`
  values, forwarded to Node unchanged.
- `--shard` fails with a message that names `test:prepared`. Any other flag
  fails with the usage text.
- A run with at least one file or pattern argument is a selected run. A
  selected run executes only the selected files with the existing two-file
  concurrency and the verification reporter, fails on any failure or
  cancellation and on a selected file that the reporter did not observe, allows
  a name pattern to leave a file with zero matching tests, prints the skipped
  and todo count, and writes no evidence report. Its reporter event file lives
  in a temporary directory and is removed afterwards. A selected run is partial
  verification and never satisfies the complete gate.
- A run with no file or pattern argument is the complete developer run and
  keeps its current behavior, including its evidence report.

Agent rules in `AGENTS.md`:

- While developing, run only the test files that cover the change, with
  `npm test -- <files>` for Node tests and `npm run test:browser -- <specs>` for
  browser specs. Rebuild before rerunning a test after a `src/` change, because
  tests run against built output.
- Do not run the complete `npm test` or `npm run test:browser` before the gate;
  `cargo xtask check` runs both suites.
- Run `cargo xtask check --suite repository` early to catch format, lint,
  length, export, and Rust findings before any long test run.
- Run the complete `cargo xtask check` once before saying work is complete.
  After a failure, fix it, rerun only the failed suite with `--suite`, then run
  the complete gate once more.

## Out Of Scope

Three related changes get their own plans: a CI `workflow_dispatch` trigger so a
pushed branch can use hosted sharded CI as the complete gate without a pull
request; a `--jobs` option that runs unit and browser shards concurrently inside
`cargo xtask check`; and a classification of the retained unit failure reports
to separate regressions from load-related timeouts.

## Milestone 1: Documentation And Protocol Contract

Define the public test command contract and the agent rules before any code
changes.

- [ ] Add `docs/protocol/developer-test-commands.md` (at most 250 lines) that
      owns the public `test`, `test:unit`, and `test:browser` contract above:
      preparation, file and name-pattern selection, rejected arguments,
      selected-run fail-closed rules, the no-report rule, and the partial
      verification semantics.
- [ ] Replace the public-command paragraph in
      `docs/protocol/ci-verification.md` with a short pointer to the new page,
      keep the prepared-command sentences, and keep the page at or under 250
      lines.
- [ ] Add the new page to the list in `docs/protocol/README.md`.
- [ ] Update the "Develop Mokly" section of `README.md` with a short targeted
      test block: one unit file, one unit case by name, one browser spec by
      path and `-g`, and the rebuild rule.
- [ ] Update the "both test entrypoints" sentence in
      `docs/architecture/build-pipeline.md` to name `test:unit`, `test`, and
      `test:browser`.
- [ ] Link the new page from `xtask/README.md` where it describes the unit
      suite, so readers find the targeted commands next to the focused suites.
- [ ] Rewrite the test and gate rules near the top of `AGENTS.md` to the agent
      rules above.
- [ ] Run `npm run format:check` on the changed Markdown and
      `node scripts/verification/source-file-length.mjs` for the protocol caps,
      then review the diff.

## Milestone 2: Developer Runner And Scripts

Implement the contract in the verification scripts and keep the strict runners
unchanged.

- [ ] Add `scripts/verification/unit-selection.mjs` that parses developer
      runner arguments into selected files and name patterns, validates files
      against `discoverUnitFiles`, and produces the rejection messages above.
      Declare its exports in a sibling `.d.mts` file for TypeScript tests.
- [ ] Change `runUnitVerification` so the developer policy uses the selection
      parser and the strict policy keeps `parseShardArgument`; keep every
      changed file at or under 300 lines, splitting the selected-run execution
      into its own module if needed.
- [ ] Implement selected runs: run only the selected files, forward name
      patterns, use a temporary reporter event file, fail closed on failures,
      cancellations, and unobserved selected files, print the skipped count,
      and write no evidence report.
- [ ] Add `test:unit` to `package.json`, make `test` forward to it, and leave
      `test:browser` and the `:prepared` scripts unchanged.
- [ ] Update `tests/verification_entrypoints.test.ts` for the new `test` and
      `test:unit` strings and the forwarding pattern.
- [ ] Add `tests/verification_unit_selection.test.ts` covering accepted files,
      absolute and normalized paths, name patterns in both forms, `--shard`
      rejection, unknown flag rejection, unknown file rejection, and the
      `.spec.ts` hint.
- [ ] Add selected-run harness cases, reusing the fixture helpers from
      `tests/verification_wrapper.test.ts` in a new test file if the existing
      file would exceed 300 lines: one selected file runs alone, a failing
      selected file fails the run, a name pattern that matches nothing in a
      selected file still passes, and no evidence report is written.
- [ ] Keep `tests/verification_evidence.test.ts` passing for strict shard
      parsing.
- [ ] Run `npm run lint`, `npm run format:check`, and the changed test files
      with the new targeted commands.

## Milestone 3: Verification, Commit, Push, And Review

Prove the commands with real runs, run the complete gate once, then commit,
push, and review.

- [ ] Smoke test from a fresh `npm run prepare:verification`:
      `npm test -- tests/ci_workflow.test.ts`,
      `npm test -- tests/ci_workflow.test.ts --test-name-pattern="lockfile"`,
      `npm run test:unit -- packages/viewer/tests/<one file>`,
      `npm test -- tests/browser/pages.spec.ts` (expect the browser hint),
      `npm test -- --shard 1/4` (expect the `test:prepared` message), and
      `npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"`.
- [ ] Confirm that no selected run created or changed a file under
      `.context/verification-reports`.
- [ ] Run `cargo xtask check --suite repository` first, then the complete
      `cargo xtask check`, and fix every finding.
- [ ] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, review the complete local diff against `origin/main`
      with `docs/implementation-review-prompt.md`, and report the numbered
      findings with severities and recommendations without changing the
      implementation.
