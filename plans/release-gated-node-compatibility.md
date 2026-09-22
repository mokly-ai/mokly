# Release-Gated Node Compatibility

## Status And Outcome

Status: implementation and verification complete; commit, push and review are
in progress. The pull request merge is the completion boundary; keep this plan
active until then.

Reduce recurring CI runner use without weakening the package release boundary.
Ordinary pull requests and `main` pushes run the complete package, unit and
browser suites on Mokly's minimum supported Node 22.14 runtime. Same-repository
Release Please pull requests add Node 24 and must pass both runtimes before the
reviewed release can merge. The repository prerequisite remains on Node 24,
and focused native-platform jobs remain on Node 22.14.

This is CI, verification-script, test and documentation work. It does not
change product behavior, release publication, UI or mockups.

Contract owners:

- [CI verification](../docs/protocol/ci-verification.md).
- [CI and npm release](../docs/protocol/npm-release.md).
- [Dependency security](../docs/protocol/dependency-security.md).
- [Local verification](../xtask/README.md).

## Milestone 1: Define the tiered runtime contract

Document the smaller ordinary matrix and the fail-closed release expansion
before changing executable CI.

- [x] Specify ordinary and Release Please runtime selection, trusted release-PR
      detection, report counts, branch-protection assumptions and delayed
      compatibility-feedback tradeoffs in the protocol docs.
- [x] Keep the developer README, xtask guidance, dependency-security boundary
      and earlier CI-performance plan aligned with the new runtime policy.
- [x] Validate the changed Markdown and inspect the documentation diff.

## Milestone 2: Select and verify the event-specific matrix

Make the repository prerequisite select one explicit runtime profile and carry
that same expectation through every matrix and the evidence aggregate.

- [x] Add failure-first workflow and evidence regressions for the ordinary
      Node 22.14 profile, the dual-runtime Release Please profile, same-repo
      release detection, and rejection of missing, extra or unsupported
      runtime evidence.
- [x] Emit the selected Node matrix and report runtimes from the repository
      job, consume it in package/unit/browser matrices, and pass the expected
      runtimes to `Required CI` without weakening prerequisite-result checks.
- [x] Update the aggregate validator and its declaration so exactly eight
      ordinary or sixteen release shard reports are accepted for the selected
      profile.
- [x] Run the focused workflow/evidence tests, typecheck the changed scripts,
      and validate the workflow with Actionlint.

## Milestone 3: Verify and deliver

Prove the complete local gate still passes, then deliver and review the whole
branch without applying review findings automatically.

- [x] Run `cargo xtask check` and require a 100% pass rate.
- [x] Inspect the final diff and whitespace status.
- [ ] Run `git add -A`, commit the completed work with a Conventional Commit,
      and push the current branch with every new file tracked.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`; report numbered findings with
      severity, impact, lettered solution options and a recommendation without
      changing the implementation.

Verification evidence: Actionlint 1.7.12 accepts the workflow after accounting
for the repository's existing Blacksmith labels. The focused CI, evidence,
deployment and release suite passes all 40 tests on exact Node 22.14.0. The
complete `cargo xtask check` passes on Node 24.14.1 with 2,239 unit/integration
tests in 420 files and 686 browser tests in 108 files; both reports contain zero
failures, skips, cancellations or reporter errors.
