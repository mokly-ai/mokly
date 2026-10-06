# Baseline-Relative Dependency Audit

Status: Active. Planned on 2026-10-06 after two registry advisories
(`sharp` below 0.35.5, GHSA-wq5f-xc86-pv6w; `shell-quote` 1.10.0,
GHSA-pqg4-j6r4-53mv) appeared on `main` and failed every branch at the live
audit. Revised the same day so the strict failure lands on a bot-maintained
dependency update pull request, not on `main` or a tracking issue. This plan
changes the audit policy only; the dependency fixes are a separate change.

## Status And Outcome

Today the live `npm audit` is the shared prerequisite of every CI job and the
first command of `cargo xtask check`. A new advisory therefore stops every
pull request and every local check, even when the branch did not change a
dependency. After this plan:

- Ordinary pull requests, pushes to `main`, and local `cargo xtask check`
  fail the audit only for issues that are **not already present at the
  comparison commit** (`git merge-base HEAD origin/main`, with the same
  uncommitted-merge rules as the repository ratchets). Issues `main` already
  has print as inherited notices.
- A daily scheduled workflow runs the **strict** audit on `main`. When it
  fails, the workflow opens or refreshes one dependency update pull request
  on the `dependency-audit/main` branch. That pull request runs the strict
  audit in CI and stays red until its branch fixes, overrides, or accepts
  every finding. When `main` is clean, the workflow closes any open update
  pull request.
- Release Please pull requests and the release publish job stay strict, so a
  release cannot proceed while `main` has an uncovered advisory.
- Both audit modes read the lockfile only (`npm audit --package-lock-only`),
  so head and baseline use the same tree source and the scheduled audit needs
  no installed dependencies.

Reviewed exceptions keep their exact-path and 31-day rules and remain the only
time-boxed element. When a record expires or goes stale, the strict scheduled
audit fails and the update pull request carries that failure; ordinary pull
requests still pass. This is CI, verification-script, xtask, test, and
documentation work. It changes no product behavior, UI, or mockups.

Contract owners:

- New: [Dependency audit baseline](../docs/protocol/dependency-audit-baseline.md)
  and [Dependency update pull request](../docs/protocol/dependency-audit-update-pr.md).
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
   lockfile are enough; workspace manifests are not required. When the
   comparison commit equals `HEAD`, as on a push to `main`, every head issue
   is inherited by definition and no second audit runs.
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
9. **CI mode selection.** The repository job passes
   `--dependency-audit "$DEPENDENCY_AUDIT"`. The value is `strict` for a
   same-repository pull request whose head ref starts with
   `dependency-audit/` or carries the `dependency-audit` label, and for a
   Release Please pull request under the existing same-repository detection.
   It is `baseline` for every other pull request and for every push. A fork
   cannot select a mode. The Release workflow's `npm run dependencies:check`
   publish step is unchanged and strict.
10. **Scheduled workflow.** `.github/workflows/dependency-audit.yml` runs
    daily off the hour and on `workflow_dispatch`. Its one job runs on
    `blacksmith-2vcpu-ubuntu-2404` with a timeout, the concurrency group
    `dependency-audit`, and `contents: write`, `pull-requests: write`, and
    `issues: write` permissions. It checks out `main` with full history,
    sets up Node 24 and npm 11.7.0, runs the strict audit through `tee` into
    `.context/dependency-audit.log` with `continue-on-error`, then runs the
    update pull request script. It runs no `npm ci` before the audit. The
    run fails only when the audit command, registry, Git, npm, or GitHub API
    fails; a failing audit with a created or refreshed pull request is a
    successful run.
11. **Update pull request.** `scripts/verification/dependency-audit-pr.mjs`
    takes `--outcome success|failure`, `--log <file>`, and `--report <json>`,
    reads `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_SERVER_URL`, and
    `GITHUB_RUN_ID`, and uses an injected `fetch` and command runner. The
    branch is `dependency-audit/main`; the label is `dependency-audit`,
    created when missing; the title is
    `fix(deps): resolve dependency audit findings`; commits use the
    `github-actions[bot]` identity. Open pull requests are found by head
    branch. On failure with no open pull request, it creates the branch from
    `main`, runs `npm ci`, then runs `npm update <package>` for every
    uncovered finding, fails if any `package.json` changed, commits a
    lockfile change as `fix(deps): update audited dependencies` or an empty
    commit `chore(deps): track dependency audit findings`, pushes, and opens
    the pull request. The body holds the UTC date, run URL, fenced log
    truncated to GitHub's limit, a link to the protocol page, and the
    required actions. On failure with an open pull request, it recreates the
    branch from current `main` and force-pushes only when every commit
    beyond `main` is the bot's; otherwise it leaves the branch alone. It
    replaces the body in both cases. On success it comments on and closes
    every open labelled pull request and deletes the branch only when every
    commit is the bot's. Any non-2xx response or command failure fails.
12. **Token.** A pull request opened with `github.token` does not trigger
    `pull_request` workflows. The workflow uses
    `secrets.DEPENDENCY_AUDIT_TOKEN || github.token`. The secret is a
    fine-grained or app installation token with contents, pull requests, and
    issues write access to this repository. Without it the update pull
    request exists but needs a maintainer push or close-and-reopen before
    CI runs. The new protocol page records the owner and scope.

## Milestone 1: Define the baseline audit contract

Document the complete contract before changing executable code. Every
protocol page must stay at or below 250 lines; `ci-verification.md` is at
248 lines and `dependency-security.md` at 234, so edit those in place or
move detail into the new pages.

- [ ] Add `docs/protocol/dependency-audit-baseline.md` covering decisions
      1 through 9: modes and CLI, comparison commit, baseline tree, order
      and laziness, issue kinds, inheritance rules, output text, fail-closed
      cases, xtask flag, and CI mode selection by pull request kind.
- [ ] Add `docs/protocol/dependency-audit-update-pr.md` covering decisions
      10 through 12: workflow triggers, permissions, steps, success and
      failure semantics, branch and label names, create, refresh, and close
      rules, the bot-only commit test, body fields, and the token.
- [ ] Update `dependency-security.md`: lockfile-only command, the two modes,
      which runs are strict, the update pull request as the place where
      fixes, overrides, and exceptions land, and links to the new pages.
      Keep the exception rules and update policy unchanged.
- [ ] Update `ci-verification.md` (boundary paragraph and the Repository gate
      row), `ci-verification-security.md`, and
      `ci-verification-repository.md` for mode selection and the strict
      release, update-pull-request, and scheduled audits.
- [ ] Update `ci-workflow.md`: add the Dependency Audit workflow to the
      workflow boundary, state the repository job's mode by event, and
      correct the sentence that says no job reads a branch-point lockfile.
- [ ] Add one cross-reference in `verification-ratchets.md` stating that the
      baseline audit shares the comparison-commit rule.
- [ ] Add both pages to `docs/protocol/README.md`; update the
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
      comparison commit equal to `HEAD` inherits everything without a second
      audit, inherited finding passes with notices, new finding fails, extra
      install location fails, inherited expired and stale exception issues
      pass, changed exception path fails, `report` and `input` issues never
      inherit, resolver and baseline registry failures fail closed, unknown
      argument fails, temporary directory is disposed on every path.
- [ ] Smoke test and record output in `.context/`: strict mode fails on the
      two current advisories; baseline mode passes with two inherited
      notices; `npm run typecheck:script-declarations` passes.

## Milestone 3: xtask mode flag and CI selection

Implement decisions 8 and 9 so local checks, ordinary pull requests, and
pushes default to baseline mode while update and release pull requests stay
strict.

- [ ] Add `--dependency-audit <baseline|strict>` to `cargo xtask check` with a
      typed error for non-repository suites; pass `-- --baseline` only in
      baseline mode; update `check_tests.rs` and `cli_tests.rs`.
- [ ] Update the `.github/workflows/ci.yml` repository job: compute
      `DEPENDENCY_AUDIT` from the same-repository head ref prefix, the label,
      and the existing release detection; pass it to the suite command.
      Update `tests/ci_workflow.test.ts` to assert the expression and flag.
- [ ] Run Actionlint on `ci.yml`, `cargo xtask check --suite repository`, and
      the focused workflow tests; record results in `.context/`.

## Milestone 4: Scheduled strict audit and update pull request

Implement decisions 10 through 12 so `main`'s advisories have one visible,
fixable owner without blocking ordinary work.

- [ ] Add `scripts/verification/dependency-audit-pr.mjs` and its declaration
      file with an injected `fetch` and command runner: label and open pull
      request discovery, branch creation, compatible update, manifest-change
      guard, commit, push, force-push, body replacement, comment, close,
      branch deletion, and body truncation.
- [ ] Add `tests/verification_dependency_audit_pr.test.ts`: first failure
      creates branch, lockfile commit, label, and pull request; no lockfile
      change makes an empty commit; a changed `package.json` fails; an open
      pull request with bot-only commits is recreated and force-pushed; one
      with human commits gets a body update and no push; success comments,
      closes, and deletes only bot-only branches; oversized logs are
      truncated; non-2xx fails; missing environment fails.
- [ ] Add `.github/workflows/dependency-audit.yml` per decisions 10 and 12
      with pinned action revisions, and `tests/dependency_audit_workflow.test.ts`
      asserting triggers, permissions, runner, timeout, concurrency, pinned
      actions, full-history checkout, strict command, `tee` log capture with
      `continue-on-error`, the script step with the token expression, and no
      `npm ci` before the audit.
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

- Create the `DEPENDENCY_AUDIT_TOKEN` secret with an authorized maintainer
  credential.
- Dispatch the Dependency Audit workflow once. Confirm it opens the update
  pull request with `shell-quote` moved to 1.12.0 by the compatible update
  (patched at 1.11.0; React DevTools Core accepts `^1.6.1`), with `sharp`
  still failing, and that CI runs on it in strict mode.
- On the update branch, bump the Miniflare `sharp` override to 0.35.5,
  confirm the strict audit passes, and merge. Confirm the next scheduled run
  finds `main` clean with nothing to close.
- Confirm an ordinary pull request passes the repository job in baseline
  mode.
