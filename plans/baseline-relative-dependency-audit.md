# Baseline-Relative Dependency Audit

Status: Active. Planned on 2026-10-06 after two registry advisories
(`sharp` below 0.35.5, GHSA-wq5f-xc86-pv6w; `shell-quote` 1.10.0,
GHSA-pqg4-j6r4-53mv) appeared on `main` and failed every branch at the live
audit. This plan changes the audit policy only; the dependency fixes are a
separate change.

## Status And Outcome

Today the live `npm audit` is the shared prerequisite of every CI job and the
first command of `cargo xtask check`. A new advisory therefore stops every
pull request and every local check, even when the branch did not change a
dependency. After this plan:

- A pull request fails the audit only for issues that are **not already
  present at its comparison commit** (`git merge-base HEAD origin/main`, with
  the same uncommitted-merge rules as the repository ratchets). Issues that
  `main` already has print as inherited notices.
- Pushes to `main`, the Release workflow, and a new daily scheduled workflow
  run the **strict** audit. The scheduled workflow opens or updates one
  tracking issue while `main` has uncovered advisories and closes it when
  `main` is clean. Release publication stays blocked until `main` is clean.
- Both audit modes read the lockfile only (`npm audit --package-lock-only`),
  so head and baseline use the same tree source and the scheduled workflow
  needs no installed dependencies.

Reviewed exceptions keep their exact-path and 31-day rules. This is CI,
verification-script, xtask, test, and documentation work. It changes no
product behavior, UI, or mockups.

Contract owners:

- New: [Dependency audit baseline](../docs/protocol/dependency-audit-baseline.md).
- [Dependency security](../docs/protocol/dependency-security.md).
- [CI verification](../docs/protocol/ci-verification.md) and its
  [security](../docs/protocol/ci-verification-security.md) and
  [repository gate](../docs/protocol/ci-verification-repository.md) pages.
- [CI workflow graph](../docs/protocol/ci-workflow.md).
- [Repository verification ratchets](../docs/protocol/verification-ratchets.md).
- [Local verification](../xtask/README.md).

Evidence logs for this plan live under
`.context/baseline-relative-dependency-audit/`.

## Contract Decisions

These decisions are fixed for every milestone below.

1. **Modes.** `npm run dependencies:check` is strict and unchanged in meaning.
   `npm run dependencies:check -- --baseline` is baseline-relative. Any other
   argument fails before npm runs. Both modes run:

   ```bash
   npm audit --json --audit-level=low --package-lock-only --include=prod --include=dev --include=optional --include=peer
   ```

2. **Comparison commit.** Baseline mode reuses `GitWorkspace.requireBase()`
   from `scripts/verification/ratchets/git.mjs`: the merge base of `HEAD` and
   `origin/main`, with the existing `MERGE_HEAD` rules. It reads `package.json`,
   `package-lock.json`, and
   `scripts/verification/dependency-audit-exceptions.json` at that commit,
   writes the first two into a temporary directory, and runs the baseline
   audit there. A verified sandbox run shows that the root `package.json` and
   lockfile are enough; workspace manifests are not required.
3. **Order and laziness.** The head audit runs first and is evaluated
   strictly. If it has no inheritable issue, the run ends with one registry
   call. Otherwise the baseline audit runs second, so an advisory published
   between the two calls can only appear in the baseline, never as a false
   new finding.
4. **Structured issues.** The evaluator returns `issues: AuditIssue[]`
   instead of `errors: string[]`. Kinds: `finding` (uncovered advisory with
   package, advisory URL, GHSA id when present, severity, title, install
   locations), `exception` (invalid, expired, stale, or duplicate record),
   `report` (npm report shape, registry error object, exit-status mismatch),
   and `input` (file read or parse failure, command launch failure, signal,
   baseline resolution failure). `ok` is true only when `issues` is empty.
5. **Inheritance.** A head `finding` is inherited when the baseline
   evaluation has a `finding` with the same package and advisory URL whose
   install locations include every head location. A head `exception` issue
   is inherited when the baseline evaluation, which uses the baseline
   commit's exception file, lockfile, report, and the same clock, has an
   `exception` issue with an identical message. `report` and `input` issues
   are never inherited. Baseline mode passes only when every head issue is
   inherited.
6. **Output.** Baseline mode prints the comparison commit once, prints each
   inherited issue as a notice with the commit and a fix-on-`main` action,
   prints non-inherited issues as errors with the existing text, and ends
   with a pass line that names the baseline commit and the inherited issue
   count, or with the existing pass message when no baseline was needed.
7. **Fail closed.** Missing `origin/main`, merge-base failure, a moved target
   during an uncommitted merge, a missing baseline file, a baseline registry
   error, or an invalid baseline report fails the run with a message that
   names the fetch or retry action.
8. **xtask.** `cargo xtask check [--dependency-audit <baseline|strict>]`
   defaults to `baseline`. The flag is valid for the complete gate and
   `--suite repository`; any other suite rejects it with a typed error before
   a subprocess starts. The repository suite runs
   `npm run dependencies:check -- --baseline` or `npm run dependencies:check`.
9. **CI.** The repository job runs one step:

   ```yaml
   env:
     DEPENDENCY_AUDIT: ${{ github.event_name == 'push' && 'strict' || 'baseline' }}
   run: cargo xtask check --suite repository --dependency-audit "$DEPENDENCY_AUDIT"
   ```

   Pull requests use baseline mode; pushes to `main` use strict mode, so
   `main`'s status shows its true state. The Release workflow's
   `npm run dependencies:check` step is unchanged and strict.

10. **Scheduled workflow.** `.github/workflows/dependency-audit.yml` runs on
    a daily cron off the hour and on `workflow_dispatch`, with read-only
    contents permission and job-level `issues: write`, on
    `blacksmith-2vcpu-ubuntu-2404` with a timeout. It checks out `main`,
    sets up Node 24 and npm 11.7.0, runs the strict audit through `tee` into
    `.context/dependency-audit.log` with `continue-on-error`, syncs the
    tracking issue, then fails when the audit failed. It runs no `npm ci`.
11. **Tracking issue.** `scripts/verification/dependency-audit-issue.mjs`
    takes `--outcome success|failure` and `--log <file>`, reads
    `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_SERVER_URL`, and
    `GITHUB_RUN_ID`, and calls the GitHub REST API through an injected
    `fetch` with the same headers as `scripts/release/evidence_github.mjs`.
    Label: `dependency-audit`, created when missing. Title:
    `Dependency audit: main has uncovered advisories`. On failure it creates
    the issue or replaces the body of the lowest-numbered open labelled issue
    with the UTC date, run URL, fenced log truncated to fit GitHub's body
    limit, and a link to the protocol page. On success it comments on and
    closes every open labelled issue with `state_reason: completed`. Pull
    requests are ignored; any non-2xx response fails the script.

## Milestone 1: Define the baseline audit contract

Document the complete contract before changing executable code. Every
protocol page must stay at or below 250 lines; `ci-verification.md` is at
248 lines and `dependency-security.md` at 234, so edit those in place or
move detail into the new page.

- [ ] Add `docs/protocol/dependency-audit-baseline.md` covering decisions
      1 through 11: modes and CLI, comparison commit, baseline tree, order
      and laziness, issue kinds, inheritance rules, output text, fail-closed
      cases, xtask flag, CI mode selection, scheduled workflow, and tracking
      issue fields.
- [ ] Update `dependency-security.md`: lockfile-only command, the two modes,
      which workflows are strict, and a link to the new page. Keep the
      exception rules and update policy unchanged.
- [ ] Update `ci-verification.md` (boundary paragraph and the Repository gate
      row), `ci-verification-security.md`, and
      `ci-verification-repository.md` for mode selection by event and the
      strict release and scheduled audits.
- [ ] Update `ci-workflow.md`: add the Dependency Audit workflow to the
      workflow boundary, state the repository job's mode by event, and
      correct the sentence that says no job reads a branch-point lockfile.
- [ ] Add one cross-reference in `verification-ratchets.md` stating that the
      baseline audit shares the comparison-commit rule.
- [ ] Add the new page to `docs/protocol/README.md`; update the
      `dependencies:check` paragraph in the root `README.md` and the
      responsibilities, CLI, and default-mode text in `xtask/README.md`.
- [ ] Validate the changed Markdown with Prettier, confirm every protocol
      page is at or below 250 lines, and inspect the documentation diff.

## Milestone 2: Baseline-relative audit script

Implement decisions 1 through 7 in the verification scripts with injected
boundaries, then prove both modes against today's registry state.

- [ ] Refactor `dependency-audit-evaluation.mjs` to return structured
      `issues`; update `dependency-audit-evaluation.d.mts`,
      `dependency_security.test.ts`, `verification_dependency_audit.test.ts`,
      and `verification_dependency_audit_validation.test.ts` to the new shape
      without changing any rule.
- [ ] Add `--package-lock-only` to the audit arguments; before switching, run
      `npm ci` and compare the installed-tree report with the lockfile-only
      report, record the comparison in `.context/`, and handle any added
      finding before this milestone closes.
- [ ] Add baseline mode to `dependency-audit.mjs` with injected baseline
      collaborators (comparison-commit resolver, revision file reader,
      temporary-directory factory with disposal) composed from `GitWorkspace`
      and `fs.mkdtemp` in `main()`; add the argument parser that accepts only
      `--baseline`; keep files near 200 lines by splitting the inheritance
      logic into `dependency-audit-baseline.mjs` with a declaration file.
- [ ] Add runner tests: lazy baseline on a clean head, head-then-baseline
      order, baseline command runs lockfile-only in the temporary directory,
      inherited finding passes with notices, new finding fails, extra
      install location fails, inherited expired and stale exception issues
      pass, changed exception path fails, `report` and `input` issues never
      inherit, resolver and baseline registry failures fail closed, unknown
      argument fails, temporary directory is disposed on every path.
- [ ] Smoke test and record output in `.context/`: strict mode fails on the
      two current advisories; baseline mode passes with two inherited
      notices; `npm run typecheck:script-declarations` passes.

## Milestone 3: xtask mode flag and CI selection

Implement decisions 8 and 9 so local checks and pull requests default to
baseline mode while pushes to `main` stay strict.

- [ ] Add `--dependency-audit <baseline|strict>` to `cargo xtask check` with a
      typed error for non-repository suites; pass `-- --baseline` only in
      baseline mode; update `check_tests.rs` and `cli_tests.rs`.
- [ ] Update `.github/workflows/ci.yml` repository step to the env-selected
      mode; update `tests/ci_workflow.test.ts` to assert the env expression
      and the flag.
- [ ] Run Actionlint on `ci.yml`, `cargo xtask check --suite repository`, and
      the focused workflow tests; record results in `.context/`.

## Milestone 4: Scheduled strict audit and tracking issue

Implement decisions 10 and 11 so `main`'s advisories have one visible owner
without blocking pull requests.

- [ ] Add `scripts/verification/dependency-audit-issue.mjs` and its
      declaration file with an injected `fetch`, label and issue discovery,
      create, body replace, comment, and close operations, and body
      truncation.
- [ ] Add `tests/verification_dependency_audit_issue.test.ts`: first failure
      creates the label and issue; repeat failure replaces the body of the
      lowest-numbered open issue; success comments and closes; pull requests
      are ignored; oversized logs are truncated; non-2xx fails; missing
      environment fails.
- [ ] Add `.github/workflows/dependency-audit.yml` per decision 10 with
      pinned action revisions and a new `tests/dependency_audit_workflow.test.ts`
      asserting triggers, permissions, runner, timeout, pinned actions, strict
      command, `tee` log capture, issue sync step with the token, final
      failure step, and the absence of `npm ci`.
- [ ] Run Actionlint on the new workflow and confirm
      `tests/workflow_runner_sizes.test.ts` accepts it.

## Milestone 5: Verify and deliver

Prove the complete local gate passes, then deliver and review the whole
branch without applying review findings automatically.

- [ ] Run a clean `npm ci`, then `cargo xtask check` and require a 100% pass
      rate; store the summary in `.context/`.
- [ ] Inspect `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; no deletions are
      expected.
- [ ] Run `git add -A`, commit the completed work with a Conventional Commit,
      and push the current branch with every new file tracked.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`; report numbered findings with
      severity, impact, lettered solution options, and a recommendation
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Dispatch the Dependency Audit workflow once and confirm it creates the
  tracking issue while `main` still has uncovered advisories.
- Confirm the next ordinary pull request passes the repository job in
  baseline mode while the `main` push run is red.
- In a separate change, fix the two advisories: bump the Miniflare `sharp`
  override to 0.35.5 and update `shell-quote` to 1.12.0 (patched at 1.11.0;
  React DevTools Core accepts `^1.6.1`). Confirm the next scheduled run
  closes the issue.
