# Targeted Developer Test Runs

Status: Active

Before this change, developer commands forced repeated complete suites and
delayed repository checks. This plan adds file and name selection, introduces
the named `test:unit` command, keeps sharding in strict runners, and runs the
complete gate once after targeted development tests.

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
changes. The public command contract has its own protocol page so the CI page
stays within its protocol cap.

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
  one test. Without filters it runs both projects and all specs. The browser
  suite sets `forbidOnly`; select by path and `-g`, never `.only`.
- `test:prepared`, `test:browser:prepared`, and `test:hydration:prepared` keep
  their shard-only argument contract. Only the strict runners accept `--shard`.

`npm test`, `npm run test:unit`, and `npm run test:browser` always prepare
package and example output first, so they test the current `src/`. The raw
commands `node --import tsx --test <file>` and `npx playwright test <spec>` skip
preparation and test the last build. Run `npm run prepare:verification` after a
`src/` change before using either raw command. Repeat raw runs without another
build only while source stays unchanged.

Developer runner arguments (`npm test -- ...` and `npm run test:unit -- ...`):

- Put every npm argument after `--`. Before any other work, the parser rejects
  non-empty `npm_config_test_name_pattern` and `npm_config_shard` values. The
  error says npm consumed the flag and shows the correct separator form. Empty
  values and unrelated npm configuration remain accepted. The parser takes an
  injected environment, with `process.env` as the default.
- Before any test process starts, the runner parses and validates argument
  forms, pattern values, file existence, and normalized paths; validates shared
  file concurrency; discovers the inventory and validates membership; checks
  prepared output; then runs tests.
  Public npm preparation happens before the runner starts. Empty discovery
  fails before execution.
- The selected helper owns discovery, membership checks, preparation checks,
  and execution. Complete runs obtain identity and report paths, remove old
  report and event files, discover and check assignments, then require prepared
  output before execution. Both complete policies use that original sequence.
- Zero or more test file paths. Resolve relative paths against the repository
  root, regardless of the runner's current directory. Accept `./` prefixes,
  redundant separators, `..` segments that stay inside the repository, platform
  separators, and absolute paths inside the repository. Normalize each path to
  repository-relative POSIX form before comparing it with the discovered unit
  inventory (`.test.ts` or `.test.tsx` under `tests/` or
  `packages/viewer/tests/`). Resolve the root and existing parent folders to
  their real paths without resolving the file itself. Duplicate normalized
  paths run once. A directory,
  missing file, file outside the repository, or file outside that inventory
  fails and names the original argument. A `.spec.ts` path fails and also names
  `npm run test:browser -- <path>`.
- Zero or more `--test-name-pattern=<regex>` or `--test-name-pattern <regex>`
  values. Each value must be non-empty and valid for the executing Node CLI's
  regex syntax, including `/pattern/flags` values. A missing, empty, or invalid
  regex value fails with a problem message and usage before inventory discovery, prepared-output
  checks, or test execution. Forward all repeated patterns unchanged and in
  order. Node applies them as alternatives. File and pattern arguments can
  appear in any order.
- `--shard` with or without a value, including the equals form, fails with a
  message that names `npm run test:prepared` and
  `cargo xtask check --suite unit --shard`. Every other flag fails with the usage
  text. The usage text lists both public commands, file paths, and both accepted
  pattern forms, as defined in
  [developer test commands](../docs/protocol/developer-test-commands.md#developer-unit-arguments).
- A run with at least one file or pattern argument is a selected run. A
  pattern without file arguments selects the complete discovered inventory and
  still writes no evidence report. Execute only the selected files with the
  [shared file concurrency](../docs/protocol/ci-suite-evidence.md#test-concurrency)
  and verification reporter. Print `unit test files active at once: <count>`
  before execution. Pass patterns before Node's file arguments. Allow skipped
  and todo tests under the existing
  developer policy, including intentional Windows skips, and print their
  combined count. Then print one line with the selected file count, partial
  verification status, and complete gate command:
  `selected files: <files>; tests run: <n>; partial verification; complete gate: cargo xtask check`.
  Sum per-file `passed + failed + cancelled` for `<n>`. After the skipped and todo
  line, warn for each explicitly named file with reported `tests = 0`:
  `warning: no test ran in <file>`. Append `; check --test-name-pattern` when a
  pattern is present. A pattern-only run prints only
  `warning: no test matched --test-name-pattern`, and only when no file reports
  any test. Print named-file warnings in selected-file order. Do not change the
  evidence schema, complete output, or zero-test exit status.
  Zero matching tests in a selected file is not a failure; the reporter must
  still observe that file.
- A selected run fails when the observed file set differs from the selected
  set in either direction: missing or unexpected files. It also fails on any
  failure, cancellation, non-zero exit, signal exit, incomplete reporter, or
  unreadable or invalid reporter output.
- A selected run never creates, removes, or changes a file under
  `.context/verification-reports`. It ignores `MOKLY_VERIFICATION_REPORT`, even
  when the override points elsewhere. An existing complete report stays
  unchanged. Its reporter event file lives in a separate temporary directory,
  which is removed afterwards, including on failure.
- A run with no file or pattern argument is the complete developer run and
  keeps its current behavior, including its developer skip policy, printed
  skipped and todo count, evidence report, and report-path override.
- Developer argument and membership errors use `ExpectedFailure`. Print only
  their message to stderr and exit 1. Unknown options and missing/empty patterns
  name the problem before usage; invalid patterns also retain the quoted value
  and SyntaxError reason. Empty discovery and internal faults retain stacks.
  The strict entrypoint stays unchanged. Validate selected outcomes in order:
  evidence, reporter completion, failed/cancelled groups, process, then file
  set. Drop `subtestsFailed` wrappers. Classify `testTimeoutFailure` and
  `cancelledByParent` under cancelled; every other type is failed. Print both
  non-empty groups in that order, using the name count or the per-file count
  when no names exist. Each shows at most 20 ordered `✖ <name>` lines, then
  `… and <k> more`. Process failures
  name the code or signal. File-set errors name missing and unexpected files.
  Exact messages follow the developer command protocol.
- Record top-level file results and failure types only in internal event data.
  Selected runs accept a file-only pass as observed with zero tests. Strict and
  complete runs keep summary-only evidence, with written failure entries exactly
  `{ name, diagnostic }`. On a failed process with missing or incomplete
  reporter output, show the process failure first with
  `; the test reporter did not finish`, without unobserved totals or warnings.
  Keep evidence faults internal on a zero exit. Print pattern values literally
  in double quotes, with no JSON escaping. Full rules are in
  [selected results](../docs/protocol/developer-test-results.md).

Every selected run, filtered Playwright run (including project selection), and
single `cargo xtask check --suite` run is partial verification. A complete public
unit or browser run alone also does not satisfy the complete gate. Only the
complete `cargo xtask check`, or the validated CI aggregate defined in
[CI verification](../docs/protocol/ci-verification.md#verification-boundary), is
complete verification.

Agent rules in `AGENTS.md`:

- While developing, run only the test files that cover the change, with
  `npm test -- <files>` for Node tests and `npm run test:browser -- <specs>` for
  browser specs. Require a 100% pass rate. Follow the preparation and raw-command
  rebuild rules above so tests use current built output.
- Do not run the complete `npm test` or `npm run test:browser` before the gate;
  `cargo xtask check` runs both suites.
- Run `cargo xtask check --suite repository` early to catch format, lint,
  length, export, and Rust findings before any long test run.
- Run the complete `cargo xtask check` once before saying work is complete.
  A local run stops at the first failed suite. A remote run reports every
  failed suite, as [remote verification](../docs/protocol/remote-verification.md) defines.
  After a failure, fix it and rerun the narrowest command that covers it: the
  targeted commands for failing unit files or browser specs, or the failed
  `--suite` for repository or package findings. Then run the complete gate once
  more. If it cannot run, explain the blocker and the checks already run. Keep
  the documentation-only and plan-only exception.

## Out Of Scope

Three related changes get their own plans: a CI `workflow_dispatch` trigger so a
pushed branch can use hosted sharded CI as the complete gate without a pull
request; a `--jobs` option that runs unit and browser shards concurrently inside
`cargo xtask check`; and a classification of the retained unit failure reports
to separate regressions from load-related timeouts.

## Milestone 1: Documentation And Protocol Contract

Completed. This milestone defines the public command contract and agent rules.
Evidence: `.context/targeted-developer-test-runs/milestone-1.md`.

- [x] Add `docs/protocol/developer-test-commands.md` (at most 250 lines) that
      owns the public `test`, `test:unit`, and `test:browser` contract above:
      preparation, file and name-pattern selection, rejected arguments,
      selected-run fail-closed rules, the no-report rule, and the partial
      verification semantics.
- [x] Replace the public-command paragraph in
      `docs/protocol/ci-verification.md` with a short pointer to the new page,
      keep the prepared-command sentences, and keep the page at or under 250
      lines.
- [x] Add the new page to the list in `docs/protocol/README.md`.
- [x] Update the "Develop Mokly" section of `README.md` with a short targeted
      test block: one unit file, one unit case by name, one browser spec by
      path and `-g`, and the rebuild rule.
- [x] Update the "both test entrypoints" sentence in
      `docs/architecture/build-pipeline.md` to name `test:unit`, `test`, and
      `test:browser`.
- [x] Link the new page from `xtask/README.md` where it describes the unit
      suite, so readers find the targeted commands next to the focused suites.
- [x] Rewrite the test and gate rules near the top of `AGENTS.md` to the agent
      rules above.
- [x] Run `npx prettier --check` on every changed Markdown file and
      `node scripts/verification/source-file-length.mjs` for the protocol caps.
      Run the four protocol structure, history, size, and split-link test files.
      Then review the diff with `git diff --stat`.

## Milestone 2: Developer Runner And Scripts

Completed. This milestone implements developer selection and shared execution while
retaining the strict runner and complete report flow.
Evidence: `.context/targeted-developer-test-runs/milestone-2.md`.

The contract now requires early regex syntax validation, including Node CLI
regex literals with flags. This keeps invalid values from reaching preparation
checks or starting a test process. Values still pass to Node unchanged.

- [x] Apply the documentation review requests: use the narrowest failure rerun,
      retain intentional Windows skips, and wrap changed protocol prose.
- [x] Add `scripts/verification/unit-selection.mjs` that parses developer
      runner arguments into selected files and name patterns, validates files
      against `discoverUnitFiles`, and produces the rejection messages above.
      Declare its exports in a sibling `.d.mts` file for TypeScript tests.
- [x] Change `runUnitVerification` so the developer policy uses the selection
      parser and the strict policy keeps `parseShardArgument`; keep every
      changed file at or under 300 lines, splitting the selected-run execution
      into its own module if needed.
- [x] Implement selected runs: run only the selected files, forward name
      patterns, use a temporary reporter event file, fail closed on failures,
      cancellations, and unobserved selected files, print the skipped count,
      and write no evidence report.
- [x] Extract one Node execution and reporter-evidence helper for complete and
      selected runs. Keep temporary event output in a separate directory and
      remove it in a `finally` block.
- [x] Reject malformed reporter counts, including null counts, with regression
      tests added before the fix.
- [x] Validate regex syntax before inventory and preparation checks. Cover
      invalid expressions and duplicate literal flags in both argument forms.
- [x] Document the selected file count and partial verification output line.
- [x] Add `test:unit` to `package.json`, make `test` forward to it, and leave
      `test:browser` and the `:prepared` scripts unchanged.
- [x] Update `tests/verification_entrypoints.test.ts` for the new `test` and
      `test:unit` strings and the forwarding pattern.
- [x] Add `tests/verification_unit_selection.test.ts` covering accepted files,
      absolute and normalized paths, name patterns in both forms, `--shard`
      rejection, unknown flag rejection, unknown file rejection, and the
      `.spec.ts` hint.
- [x] Add selected-run harness cases, reusing the fixture helpers from
      `tests/verification_wrapper.test.ts` in a new test file if the existing
      file would exceed 300 lines: one selected file runs alone, a failing
      selected file fails the run, a name pattern that matches nothing in a
      selected file still passes, and no evidence report is written.
- [x] Keep `tests/verification_evidence.test.ts` passing for strict shard
      parsing.
- [x] Check `npm run typecheck:script-declarations`.
- [x] Run the new selection and harness tests on the official Node 22.14.0
      binary. Keep zero-match patterns and per-file summary evidence working.
- [x] Restore complete-run report invalidation before discovery and preparation.
      Keep selected-run discovery and preparation in the selected helper.
- [x] Reject npm-consumed pattern and shard flags before all other parser work.
      Inject the environment and test omitted npm separators.
- [x] Keep plan evidence in the milestone context files instead of plan prose.
- [x] Update the Miniflare-scoped Sharp override to 0.35.5 and resolve a patched
      Shell Quote through React DevTools. Keep lockfile changes scoped, run
      `npm ci`, update the current security contract, and run the live audit.
      Decision: PR #146 shipped the same fixes; use main's dependency files.
- [x] Pass `cargo xtask check --suite repository`.
- [x] Review `git diff --stat` and the full working diff, including new files.
- [x] Run `npm run lint`, `npm run format:check`, and the changed test files
      with the new targeted commands.

## Milestone 3: Verification, Commit, Push, And Review

Completed. The commands passed real runs and the complete gate. The branch is
pushed. Review 1 fixed findings 2 and 7; the re-review found no new findings.
Merge evidence: `.context/targeted-developer-test-runs/merge-main.md`.
Refresh evidence: `.context/targeted-developer-test-runs/after-refresh-verification.md`.
Smoke evidence: `.context/targeted-developer-test-runs/smoke-tests.md`.
Gate evidence: `.context/targeted-developer-test-runs/gate.md`.
Document check evidence: `.context/targeted-developer-test-runs/document-checks.md`.
Review evidence: `.context/targeted-developer-test-runs/review-1.md`.
Review-fix evidence: `.context/targeted-developer-test-runs/review-fixes.md`.
Re-review evidence: `.context/targeted-developer-test-runs/review-2.md`.

Decision: The orchestrating agent accepted the complete gate on `732c981`
and merged documentation-only main updates without another complete gate.

- [x] Split dependency remediation and targeted test commands into separate
      commits before integrating main.
- [x] Merge fetched `origin/main`, preserve each main change, confirm two
      merge parents, and inspect every path in the remerge diff.
- [x] Check this plan against the evidence-log rule after the main merge.
- [x] Merge PR #146 dependency updates, keep main's lockfile and policy,
      preserve the test scripts, confirm two parents, and run a clean install.
- [x] Rerun the changed verification test files after the dependency refresh.
- [x] Merge main's current documentation rules and cleanup, preserve its
      permalinks and deletions, confirm two parents, inspect each remerge path,
      and prove that only Markdown changed from the accepted gate tree.
- [x] Run the repository suite and the document-reading tests after the
      documentation merge.
- [x] Smoke test from a fresh `npm run prepare:verification`:
      `npm test -- tests/ci_workflow.test.ts`,
      `npm test -- tests/ci_workflow.test.ts --test-name-pattern="lockfile"`,
      `npm run test:unit -- packages/viewer/tests/routes.test.ts`,
      `npm test -- tests/browser/pages.spec.ts` (expect the browser hint),
      `npm test -- --shard 1/4` (expect the `test:prepared` message),
      `npm test --test-name-pattern=lockfile` (expect the npm-consumed message), and
      `npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"`.
- [x] Confirm that no selected run created or changed a file under
      `.context/verification-reports`.
- [x] Run `cargo xtask check --suite repository` first, then the complete
      `cargo xtask check`, and fix every finding.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [x] Fix review findings 2 and 7, and record the open findings.
- [x] Merge current main with shared file concurrency and preserve all changes.
- [x] Run affected tests on both Node versions, then the required gates.
- [x] Commit and push this review-fix round before the next review.
- [x] After the push, review the complete local diff against `origin/main`
      with `docs/implementation-review-prompt.md`, and report the numbered
      findings with severities and recommendations. Then apply the review-fix
      rule in `AGENTS.md`.
  - User decisions on findings 1, 3, 4, 5, and 6 are in Milestone 4.

## Milestone 4: Review Decisions

This milestone applies the selected output and error improvements, shares the
Windows-safe npm test launcher, and integrates main. Completed. Review 3 fixed
finding 5; the re-review found no new findings.
Evidence: `.context/targeted-developer-test-runs/milestone-4.md`.
Review 3: .context/targeted-developer-test-runs/review-3.md.

Decisions: The user selected finding 1 option A: count tests from file summaries,
warn for each zero-test file, and keep a passing exit. The user selected finding
3 option B: use one shared npm test helper with the existing executable resolver.
The user ignored finding 4: keep the build-first order. The user selected finding
5 option A for the developer runner only: show clear expected failure reports.
The user selected finding 6 option A and approved all three earlier changes:
the npm-consumed flag guard, stricter reporter evidence, and rerunning only the
failing tests after a gate failure.

- [x] Define exact selected output and developer errors in the protocol and
      keep the plan Contract consistent before changing code.
- [x] Implement finding 1 with per-file counts and zero-test warnings. Keep
      reports and complete/strict runs unchanged. Add regression tests.
- [x] Implement finding 5 with one expected error type, problem-first argument
      messages, ordered outcome validation, and internal fault stacks. Test it.
- [x] Implement finding 3 with a shared test helper that uses
      `NodeBaselineExecutableResolver` and shell-free `execFile` in all three
      npm probe loops. Keep literal arguments and filter undefined env values.
- [x] Commit each implemented finding separately and name it in the message.
- [x] Merge fetched main, capture its source audit, preserve every main change,
      confirm two parents, and inspect each remerge path.
- [x] Pass lint, formatting, declaration checks, and every affected test on
      Node 24 and Node 22.14. Run the zero-match and unknown-option smoke commands.
- [x] Pass the repository suite, then run the complete gate once on the merged
      tree. Use targeted reruns after a failure and report repeated unrelated failures.
- [x] Run the deletion checks, commit remaining changes, and push the branch.
- [x] After the push, review the complete diff against `origin/main` with
      `docs/implementation-review-prompt.md`, report findings, then apply the
      review-fix rule in `AGENTS.md`. The orchestrating agent runs this review.
  - User decisions on Review 3 findings 1, 2, 3, 4, and 6 are in Milestone 5.

## Milestone 5: Main Merge And Review 3 Fixes

Integrate current main before fixing selected-run warnings, file evidence,
failure groups, interruption reports, and literal pattern messages.
Evidence: `.context/targeted-developer-test-runs/milestone-5.md`.
Merge audit: `.context/targeted-developer-test-runs/merge-main.md`.

Decision: The user selected option A for Review 3 findings 1, 2, 3, 4, and 6.
Keep complete and strict report schemas unchanged. Leave post-push review to
the orchestrating agent.

- [x] Merge fetched main first. Preserve all changes, resolve each path,
      confirm two parents, and inspect every remerge path.
- [x] Apply generated-path and local/remote gate-rule follow-ups. Check the
      protocol caps and coherent merged guidance.
- [x] Run verification tests on Node 24 and Node 22.14, then the repository
      suite. Commit the merge and semantic follow-up and push for hosted CI.
- [x] Define the selected-output contract before its implementation.
- [x] Fix finding 1: warn only for named files, or once for an empty pattern run.
- [x] Fix finding 4: recognize file-only passes for selected runs; keep strict
      summary-only file evidence.
- [x] Fix finding 2: classify reporter failures, omit wrappers, and print both
      failed and cancelled groups without changing written report entries.
- [x] Fix finding 3: prefer process errors over missing or incomplete reporter
      output on process failure. Test a real signal and temporary cleanup.
- [x] Fix finding 6: show the pattern exactly as typed inside double quotes.
- [x] Commit each finding separately and name its review number in the body.
- [x] Pass lint, formatting, declarations, affected tests on both Node versions,
      and the repository suite. Push the tested code before the auto gate.
- [ ] Run the complete auto gate once. Record executor and duration. Use the
      targeted failure rules and report repeated unrelated failures.
- [ ] Tick completed tasks, commit, run deletion checks, and push the branch.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`, report findings, then apply the
      review-fix rule in `AGENTS.md`. The orchestrating agent runs this review.
