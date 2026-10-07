# Baseline-Relative Dependency Audit

Status: Active. Planned on 2026-10-06 after two registry advisories
(`sharp` below 0.35.5, GHSA-wq5f-xc86-pv6w; `shell-quote` 1.10.0,
GHSA-pqg4-j6r4-53mv) failed every branch at the live audit. Both fixes already
landed on `main` in [PR #146](https://github.com/mokly-ai/mokly/pull/146): the
Miniflare `sharp` override is 0.35.5 and `shell-quote` is 1.12.0. The live
strict audit now passes with the reviewed `braces` exception. Maintainer
`calummoore` created the `DEPENDENCY_AUDIT_TOKEN` repository secret on
2026-10-06; the token has no expiration date (user decision, 2026-10-07).
This plan changes the audit policy and puts future strict failures on a
bot-maintained update pull request.

## Status And Outcome

Before this plan, the strict live audit was the shared prerequisite of every
CI job and the first command of `cargo xtask check`. A new advisory stopped
every pull request and every local check, even when the branch did not change
a dependency. This plan provides:

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

The implementer completes, checks, commits, and pushes one milestone at a time.
Claude reviews each milestone before the implementer continues. The implementer
stops after the commit-and-push TODO in Milestone 5. Claude owns the final
post-push review and reports the findings under the repository review-fix rule.

## Contract Decisions

These decisions are fixed for every milestone below.

1. **Modes.** `npm run dependencies:check` is strict and unchanged in meaning.
   `npm run dependencies:check -- --baseline` is baseline-relative. The only
   accepted options are `--baseline` and optional `--report <file>` in either
   mode; any other argument fails before npm runs. Both modes run:

   ```bash
   npm audit --json --audit-level=low --package-lock-only --include=prod --include=dev --include=optional --include=peer --prefix .
   ```

   Set the command's working directory to the tree under audit. Keep the
   explicit `--prefix .` and remove inherited npm prefix, local-prefix,
   workspace, workspaces, and global environment settings. Set `INIT_CWD` to
   that directory. Keep registry and authentication configuration. This applies
   to npm-invoked head and temporary audits.

   On every completed run, pass or fail, `--report` writes a JSON summary with
   `mode` (`strict` or `baseline`), `ok`, optional `comparisonCommit`, and
   structured `issues`. Each baseline-mode issue also has an `inherited`
   boolean. A report write failure is an `input` issue and fails the run.

2. **Comparison commit.** Baseline mode reuses `GitWorkspace.requireBase()`
   from `scripts/verification/ratchets/git.mjs`: the merge base of `HEAD` and
   `origin/main`, with the existing `MERGE_HEAD` rules. It reads `package.json`,
   `package-lock.json`, and
   `scripts/verification/dependency-audit-exceptions.json` at that commit.
   Compare all three with their working-tree files byte for byte. If all
   match, inherit every head `finding` and `exception` issue without a second
   registry call. This covers clean pushes to `main` and pull requests that
   leave these files unchanged. Otherwise write the baseline manifest and
   lockfile into a temporary directory and audit there, even when the
   comparison commit equals `HEAD`. The root manifest and lockfile are enough;
   workspace manifests are not required. `report` and `input` issues still fail.
3. **Order and laziness.** The head audit runs first and is evaluated
   strictly. If any head issue is `report` or `input`, print every head issue
   as an error and fail without a baseline audit. A clean head also ends with
   one registry call. After a head finding or exception issue, resolve the
   comparison commit and read all three baseline files. Skip the second audit
   only when all three are byte-identical to the working-tree files. Otherwise
   run the baseline audit second, even if the comparison equals `HEAD`. An
   advisory published between the two calls can only appear in the baseline,
   never as a false new finding. Both evaluations use the same captured clock.
4. **Structured issues.** The evaluator returns `issues: AuditIssue[]`
   instead of `errors: string[]`. Every issue has `kind` and `message`.
   Kinds: `finding` (uncovered advisory with `package`, `advisoryUrl`, optional
   GHSA `advisoryId`, `severity`, `title`, and `installLocations`),
   `exception` (invalid, expired, stale, or duplicate record),
   `report` (npm report shape, registry error object, exit-status mismatch),
   and `input` (file read or parse failure, command launch failure, signal,
   baseline resolution failure, invalid lockfile or clock, non-array exception
   file, temporary-directory creation/write/disposal failure, report write
   failure). The strict evaluator's `ok` is true only when `issues` is empty;
   the baseline run's `ok` is true when all its issues are inherited.
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
   count. When no baseline was needed, it keeps the existing clean-audit or
   accepted-risk success output.
7. **Fail closed.** Missing `origin/main`, merge-base failure, a moved target
   during an uncommitted merge, a missing baseline file, a baseline registry
   error, or an invalid baseline report fails the run with a message that
   names the fetch or retry action. Wrap `GitWorkspace` errors in an audit
   message such as "Dependency audit could not resolve the comparison commit.
   Run git fetch origin main and retry." Append the Git cause; do not rely on
   its "Repository ratchet" text as the audit's required action.
8. **xtask.** `cargo xtask check [--dependency-audit <baseline|strict>]`
   defaults to `baseline`. The flag is valid for the complete gate and
   `--suite repository`; any other suite rejects it with a typed error before
   a subprocess starts. The repository suite runs
   `npm run dependencies:check -- --baseline` or `npm run dependencies:check`.
   A complete gate on Blacksmith Testboxes passes the same mode to its remote
   repository command (`testbox-suite.mjs --dependency-audit <mode>`).
9. **CI mode selection.** The repository job passes
   `--dependency-audit "$DEPENDENCY_AUDIT"`. The value is `strict` for a
   same-repository pull request whose head ref starts with
   `dependency-audit/` or carries the `dependency-audit` label, and for a
   Release Please pull request under the existing same-repository detection.
   It is `baseline` for every other pull request and for every push. A fork
   cannot select a mode. The Release workflow's `npm run dependencies:check`
   publish step is unchanged and strict. Its complete fallback runs
   `cargo xtask check --dependency-audit strict`. Strict mode on every surface honours
   active reviewed exceptions exactly as today: a valid, unexpired, used
   record covers its advisory, and an expired or stale record fails the
   release pull request, the scheduled audit, and the update pull request
   until the expired record gets a new risk review or is removed, or the
   stale record is removed.
10. **Scheduled workflow.** `.github/workflows/dependency-audit.yml` runs
    daily off the hour and on `workflow_dispatch`. Its one job runs on
    `blacksmith-2vcpu-ubuntu-2404` with a 30-minute timeout, concurrency group
    `dependency-audit`, no cancellation of an active run, and `contents: write`,
    `pull-requests: write`, and `issues: write` permissions. It checks out
    `main` with full history and
    `token: ${{ secrets.DEPENDENCY_AUDIT_TOKEN || github.token }}`. It sets up
    Node 24 and npm 11.21.0 (the exact `packageManager` pin), creates
    `.context/`, and runs the strict audit with
    `--report .context/dependency-audit.json` through `tee` into
    `.context/dependency-audit.log` with `continue-on-error`. Use `shell: bash`
    or explicit `set -o pipefail` so the audit's failure survives the pipe.
    Then run the update pull request script with the step's original outcome,
    log, and report. Run no `npm ci` before the audit. A failure caused only
    by uncovered findings or exception issues is handled by the update pull
    request and succeeds. Command, registry, input, report, Git, npm, or GitHub
    API failures fail the scheduled run with an action message.
11. **Update pull request.** `scripts/verification/dependency-audit-pr.mjs`
    takes `--outcome success|failure`, `--log <file>`, and `--report <json>`,
    reads `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_SERVER_URL`, and
    `GITHUB_RUN_ID`, and uses an injected `fetch` and command runner. The
    optional `GITHUB_API_URL` defaults to `https://api.github.com` and selects
    the REST server. Requests use Bearer authentication, the GitHub JSON
    Accept header, API version `2022-11-28`, and a User-Agent.
    The branch is `dependency-audit/main`; the label is `dependency-audit`,
    created when missing; the title is
    `fix(deps): resolve dependency audit findings`; commits use the
    `github-actions[bot]` identity. Create, refresh, and close identify open
    pull requests only by head `dependency-audit/main` in this repository.
    The label marks that pull request and selects strict CI; a label alone
    never selects a pull request to close. Before any Git or GitHub mutation,
    it requires a valid strict
    JSON summary from decision 1 and an outcome that agrees with its `ok`.
    Missing or invalid reports, any `report` or `input` issue, or a mismatched
    outcome fail with an action message and create, refresh, or close nothing.
    On failure with no open pull request, it creates the branch from `main`,
    runs `npm ci --ignore-scripts`, then runs
    `npm update <package> --ignore-scripts` for each distinct uncovered
    package. All Git and npm child environments omit `GITHUB_TOKEN` and
    `GH_TOKEN`. It fails if any
    `package.json` changed and commits a
    lockfile change as `fix(deps): update audited dependencies` or an empty
    commit `chore(deps): track dependency audit findings`, pushes, and opens
    the pull request. The body holds the UTC date, run URL, fenced log
    truncated by retaining its final part, a link to the protocol page, and
    the required actions. The complete body stays within GitHub's limit of
    65,536 UTF-16 code units, including the date, links, fences, truncation notice,
    and actions. The actions always include: "If CI did not start on this
    pull request, push a commit to the branch or close and reopen the pull
    request." On failure with an open pull request, it recreates the
    branch from current `main` and force-pushes only when every commit
    beyond `main` is the bot's; otherwise it leaves the branch alone. It
    replaces the body in both cases. If the branch exists without an open
    pull request, recreate and force-push it only when every commit beyond
    `main` is the bot's, including when there are none. Otherwise fail and
    name the branch with a maintainer action to delete it or reopen its pull
    request. Bot commits have the `github-actions[bot]` author and committer
    identity with email `41898282+github-actions[bot]@users.noreply.github.com`.
    Force-push with a lease for the inspected tip to preserve a concurrent
    human commit. On success it comments on and closes
    every matching open update pull request and deletes the branch only when every
    commit beyond current `main` is the bot's, including none. Any non-2xx
    response or command failure fails.
12. **Token.** Pull requests opened or branches pushed with `github.token`
    do not trigger CI. Checkout and API calls both use
    `secrets.DEPENDENCY_AUDIT_TOKEN || github.token`, so refreshed branches
    also trigger CI. The secret is a
    fine-grained personal access token or app installation token with
    repository access to this repository only and exactly these repository
    permissions: Contents read and write, to push and delete the branch;
    Pull requests read and write, to open, update, comment on, and close
    the pull request; and Issues read and write, to create the label.
    Metadata read is implicit. No account or Workflows permission is
    granted. A personal token is bounded by its owner's write access; the
    owner is the pull request author and cannot approve it. An installation
    token acts as its app. A fine-grained token can have an expiration date;
    this token has none, by user decision on 2026-10-07. If the
    organization requires approval for fine-grained tokens, an owner
    approves the request. Without the secret the update pull request exists
    but needs a maintainer push or close-and-reopen before CI runs. The new
    protocol page records owner `calummoore`, the exact scope, creation date
    2026-10-06, the absence of an expiration date, and the replacement rule:
    replace the token when it may be exposed, when its owner loses write
    access, or when it is revoked. A revoked token in the secret fails
    checkout; only an empty secret selects the `github.token` fallback.

## Milestone 1: Define the baseline audit contract

Completed. The contract, guide test split, and requested review changes pass
the focused checks and the complete `cargo xtask check` gate.

Document the complete contract before changing production code. Claude approved
the documentation-test split and assertion updates in this milestone. Every
changed protocol page must stay at or below 250 lines. Edit the existing
boundary text in place and put detailed contracts in the new pages.

- [x] Add `docs/protocol/dependency-audit-baseline.md` covering decisions
      1 through 9: modes and CLI, comparison commit, baseline tree, order
      and laziness, issue kinds, inheritance rules, output text, fail-closed
      cases, xtask flag, and CI mode selection by pull request kind.
- [x] Add `docs/protocol/dependency-audit-update-pr.md` covering decisions
      10 through 12: workflow triggers, permissions, steps, success and
      failure semantics, branch and label names, create, refresh, and close
      rules, the bot-only commit test, body fields, and the token.
- [x] Update `dependency-security.md`: lockfile-only command, the two modes,
      which runs are strict, the update pull request as the place where
      fixes, overrides, and exceptions land, and links to the new pages.
      Keep the exception rules and update policy unchanged.
- [x] Update `ci-verification.md` (boundary paragraph and the Repository gate
      row), `ci-verification-security.md`, and
      `ci-verification-repository.md` for mode selection and the strict
      release, update-pull-request, and scheduled audits.
- [x] Update `ci-workflow.md`: add the Dependency Audit workflow to the
      workflow boundary, state the repository job's mode by event, and
      correct the sentence that says no job reads a branch-point lockfile.
- [x] Add one cross-reference in `verification-ratchets.md` stating that the
      baseline audit shares the comparison-commit rule.
- [x] Add both pages to `docs/protocol/README.md`; update the
      `dependencies:check` paragraph in the root `README.md` and the
      responsibilities, CLI, and default-mode text in `xtask/README.md`.
- [x] Close all nine brief gaps in these protocol pages and decisions:
      report producer and schema, operational audit failures, checkout token,
      npm lifecycle and token isolation, a branch without an open pull request,
      head input/report failures, audit-specific Git errors, token rotation,
      and audit pipe status. Correct the plan status and post-merge follow-up.
- [x] Validate the changed Markdown with Prettier, confirm every changed protocol
      page is at or below 250 lines, and inspect the documentation diff.
- [x] Update the two obsolete workflow assertions in `tests/guides_ci.test.ts`
      and split the file into topic modules within the 300-line limit.
      Preserve every test and assertion meaning. Run the focused tests and
      `cargo xtask check` before commit and push.
- [x] Apply Claude's contract corrections: identical-input shortcut, strict
      release fallback, update-branch-only pull request selection, concrete CI
      recovery copy, exact body limit and retained log tail, exception wording,
      protocol process cleanup, and the implementation wording TODO below.

Evidence: `.context/baseline-relative-dependency-audit/milestone-1-checks.md`.

## Milestone 2: Baseline-relative audit script

Completed. The scripts, documentation, unit tests, and live fixture smoke tests
meet decisions 1 through 7.

Implement decisions 1 through 7 in the verification scripts with injected
boundaries. Prove both modes with reproducible Git fixtures and the live registry.

- [x] Read comparison and working-tree inputs as `Buffer` bytes and compare
      them with `Buffer.equals`. Classify every current error source explicitly;
      non-array exception files and invalid clocks are `input` issues. Update
      the baseline page's kind table with these cases.
- [x] Refactor `dependency-audit-evaluation.mjs` to return structured
      `issues`; update `dependency-audit-evaluation.d.mts`,
      `dependency_security.test.ts`, `verification_dependency_audit.test.ts`,
      and `verification_dependency_audit_validation.test.ts` to the new shape
      without changing any rule.
- [x] Add `--package-lock-only` to the audit arguments; before switching, run
      `npm ci` and compare the installed-tree report with the lockfile-only
      report, record the comparison in `.context/`, and handle any added
      finding before this milestone closes.
- [x] Add baseline mode to `dependency-audit.mjs` with injected baseline
      collaborators (comparison-commit resolver, revision file reader,
      temporary-directory factory with disposal) composed from `GitWorkspace`
      and `fs.mkdtemp` in `main()`; add the argument parser that accepts only
      `--baseline` and `--report <file>`, with an injected report writer;
      keep files near 200 lines by splitting the inheritance
      logic into `dependency-audit-baseline.mjs` with a declaration file.
- [x] Add runner tests: lazy baseline on a clean head, head-then-baseline
      order, baseline command runs lockfile-only in the temporary directory,
      byte-identical manifest, lockfile, and exception inputs inherit eligible
      issues without a second audit, comparison commit equal to `HEAD` with a
      changed working-tree lockfile runs the second audit and fails a new
      finding, inherited finding passes with notices, new finding fails, extra
      install location fails, inherited expired and stale exception issues
      pass, changed exception path fails, `report` and `input` issues never
      inherit, any head `report` or `input` issue skips the baseline and prints
      every head issue as an error, resolver and baseline registry failures
      fail closed with audit-specific action text and the Git cause, unknown
      arguments fail before npm, JSON summaries are written on success and
      failure in both modes, write failures fail, temporary directory is
      disposed on every path. Update `verification_dependency_audit_runner.test.ts`.
- [x] Run four live fixture smokes through `npm run dependencies:check -- ...`
      in temporary local clones outside the repository, such as `/tmp`. Use
      `f52303c`'s vulnerable root manifest and lockfile plus the new scripts
      for the vulnerable comparison commit (`origin/main` in each clone).
      Record command counts and output under the plan's `.context/` directory:
      A, unrelated head edit inherits both advisories with one registry call;
      B, harmless head script edit with the same lockfile inherits both with
      a second audit in the temporary directory;
      C, current clean comparison lockfile and vulnerable head fails both as
      new findings; D, strict vulnerable tree fails both.
- [x] Prove the npm-invoked temporary audit uses its own lockfile despite
      inherited `npm_config_*` settings. Fix directory selection if needed,
      add a regression first, and document explicit prefix or environment
      handling without dropping registry configuration or credentials.
- [x] Run `npm run typecheck:script-declarations` and the focused audit tests;
      record their results under the plan's `.context/` directory.

Evidence: `.context/baseline-relative-dependency-audit/milestone-2-checks.md`.

## Milestone 3: xtask mode flag and CI selection

Completed. The mode flag, CI selection, and strict release fallback pass the
required Milestone 3 checks.

Implement decisions 8 and 9 so local checks, ordinary pull requests, and
pushes default to baseline mode while update and release pull requests stay
strict.

Merge justification for `30ce35f`:
`.context/baseline-relative-dependency-audit/merge-2-justification.md`.

- [x] Add `--dependency-audit <baseline|strict>` to `cargo xtask check` with a
      typed error for non-repository suites; pass `-- --baseline` only in
      baseline mode; update `check_tests.rs` and `cli_tests.rs`.
- [x] Update the `.github/workflows/ci.yml` repository job: compute
      `DEPENDENCY_AUDIT` from the same-repository head ref prefix, the label,
      and the existing release detection; pass it to the suite command.
      Update `tests/ci_workflow.test.ts` to assert the expression and flag.
- [x] Change the complete fallback in `.github/workflows/release.yml` to
      `cargo xtask check --dependency-audit strict`. Assert the command in
      `tests/release.test.ts`; split that file as needed to meet 300 lines.
- [x] Update `xtask/README.md`, the root README, and protocol status text for
      implemented local and CI mode selection. Keep scheduled-audit wording
      cleanup in Milestone 4.
- [x] Run Actionlint on `ci.yml` and `release.yml`, `cargo xtask check --suite repository`, and
      the focused workflow tests; record results in `.context/`.
- [x] Run Rust 1.95.0 formatting, workspace Clippy and tests, the strict
      repository suite, the typed-error unit-suite smoke, the focused guide
      tests, and source-length audits. Record results in `.context/`.

Evidence: `.context/baseline-relative-dependency-audit/milestone-3-checks.md`.

## Milestone 4: Scheduled strict audit and update pull request

Completed. The scheduled workflow, update script, focused checks, and local
failure-to-success smoke test pass. The implementation loads without installed
dependencies and preserves human branch commits.

Implement decisions 10 through 12 so `main`'s advisories have one visible,
fixable owner without blocking ordinary work.

- [x] Add `scripts/verification/dependency-audit-pr.mjs` and its declaration
      file with an injected `fetch` and command runner: label and open pull
      request discovery, branch creation, compatible update, manifest-change
      guard, commit, push, force-push, body replacement, comment, close,
      branch deletion, and body truncation.
- [x] Add `tests/verification_dependency_audit_pr.test.ts`: first failure
      creates branch, lockfile commit, label, and pull request; no lockfile
      change makes an empty commit; a changed `package.json` fails; an open
      pull request with bot-only commits is recreated and force-pushed; one
      with human commits gets a body update and no push; success comments,
      closes only pull requests with head `dependency-audit/main` in this
      repository, preserves other pull requests carrying the strict-CI label,
      and deletes only bot-only branches. Oversized logs keep their final part;
      the complete body stays within 65,536 characters with date, links,
      truncation notice, fences, and actions intact. The required actions always
      include the exact missing-CI recovery sentence from decision 11.
      Non-2xx fails; missing environment fails. Missing or invalid
      reports, input/report issues, and mismatched outcomes make no Git or
      GitHub mutations. Both npm commands ignore scripts and omit the token.
      An existing branch without an open pull request is recreated only with
      bot-only commits, including none; human commits fail with an action.
- [x] Add `.github/workflows/dependency-audit.yml` per decisions 10 and 12
      with pinned action revisions, and `tests/dependency_audit_workflow.test.ts`
      asserting triggers, permissions, runner, timeout, concurrency, pinned
      actions, full-history checkout with the token expression, strict
      command and JSON report, `.context/` creation before `tee`, pipefail via
      `shell: bash` or `set -o pipefail`, `continue-on-error`, the script step
      with the same token expression, and no `npm ci` before the audit.
- [x] Run Actionlint on the new workflow and confirm
      `tests/workflow_runner_sizes.test.ts` accepts it.
- [x] Run the focused lint, formatting, declaration, source-length, workflow,
      audit, npm-pin, and protocol checks. Run all workflows through pinned,
      checksum-verified Actionlint. Smoke-test failure and later success with
      a local GitHub API server and a temporary bare Git remote outside the
      repository. Prove the script loads without installed dependencies.
- [x] Rewrite transitional contract wording to describe implemented behavior
      in the root README, `xtask/README.md`, CI pages, dependency security,
      both new audit pages, the protocol index, and the ratchet cross-reference.
      Update each affected Delivery Status section. Remove "approved contract",
      "active implementation target", "pending implementation", and similar
      transition text after the implementations above pass their checks.

Evidence: `.context/baseline-relative-dependency-audit/milestone-4-checks.md`.

## Milestone 5: Verify and deliver

Prove the complete local gate passes, then deliver the whole branch.
The implementer stops after the commit and push. Claude runs the final review.

- [x] Run a clean `npm ci`, then `cargo xtask check` and require a 100% pass
      rate; store the summary in `.context/`.
- [x] Inspect `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; no feature removals
      are expected. The authorized Milestone 3 split replaces
      `xtask/src/check.rs` with modules under `xtask/src/check/`.
- [x] Run `git add -A`, commit the completed work with a Conventional Commit,
      and push the current branch with every new file tracked.
- [x] Claude: after the push, review the complete diff against `origin/main`
      using `docs/implementation-review-prompt.md`. Keep the review read-only.
      Report numbered findings with severity, category, effort, impact,
      lettered options, recommendation, and `Auto-fix` tags. Apply the General
      review-fix rule: fix `Auto-fix: yes` findings, check, commit, push, and
      re-review once; fix new eligible findings once more, then stop and
      report the rest. The implementer does not run this review TODO.

  - Open review finding 1 (Medium): a refresh force-push may fail after `main` changes a workflow file; verify, then delete and recreate the branch if needed.
  - Open review finding 2 (Low): document the reliance on automatic head-branch deletion and tell maintainers to delete an obsolete human update branch.
  - Open review finding 3 (Low): inheritance cannot see a version change at an already-flagged location; document the limit.
  - Open review finding 5 (Low): require a fine-grained personal access token and state the fallback token's repository-setting condition.
  - Open review finding 8 (Low): add a real-Git test for the update script.

Evidence: `.context/baseline-relative-dependency-audit/milestone-5-checks.md`.
Review fix evidence: `.context/baseline-relative-dependency-audit/review-fixes-checks.md`.
Review summary: round 1 reported 8 findings (1 Medium, 7 Low); `46b3f0b`
fixed findings 4, 6, and 7; the re-review found no new finding. Reports:
`.context/baseline-relative-dependency-audit/review-round-1.md` and
`review-round-2.md`.

## Milestone 6: Integrate with main's remote executor

Main added complete-gate execution on Blacksmith Testboxes (#160) while this
branch was open. Merge it and keep a strict complete gate strict on Testboxes.

- [x] Merge `origin/main` (`3363022`, `64bf722`). Resolve conflicts path by
      path. Keep main's guide-test split and port this branch's two
      assertion changes into it.
- [x] Pass `--dependency-audit` through the remote runner and plan to
      `testbox-suite.mjs`, which accepts it only for the repository suite.
      Test the plan command, strict reaching the remote runner, and wrapper
      forwarding and rejections.
- [x] Document the mode in the Testbox command table, the baseline contract,
      and the xtask README. Keep the protocol index within 250 lines.
- [x] Confirm the complete gate passes on the merged tree. PR CI passed
      every job, including `Required CI`, on Node 22.14. The local Node 24.21
      run fails only main's `tests/shared_example.test.ts` (2 tests), which
      also fail on unmodified `origin/main` and pass on Node 22.14.
- [x] Commit and push.
- [x] Claude: review the integration diff with
      `docs/implementation-review-prompt.md` after the push and apply the
      review-fix rule. The review found no new finding
      (`.context/baseline-relative-dependency-audit/review-round-3.md`).

Merge justification: `.context/baseline-relative-dependency-audit/merge-3-justification.md`.
Evidence: `.context/baseline-relative-dependency-audit/merge-3-xtask-check.log`.

## Post-merge follow-up (non-blocking)

The advisory fixes already landed in PR #146. Maintainer `calummoore` already
created the repository secret on 2026-10-06. The token has no expiration date,
so no rotation date applies.

- Dispatch the Dependency Audit workflow once. Confirm it finds `main` clean
  with the reviewed `braces` exception and opens no pull request.
- Confirm an ordinary pull request passes the repository job in baseline
  mode.
