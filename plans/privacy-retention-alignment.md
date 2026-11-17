# Privacy Retention Alignment

Status: Completed. [PR #85](https://github.com/mokly-ai/mokly-cloud/pull/85)
of the old `mokly-ai/mokly-cloud` repository merged on 2026-11-06 and completed
this plan. On 2026-11-02, the user deferred all five review findings to
follow-up work. A user decision of 2026-10-31 keeps this plan and the
`plans/README.md` index.

Align Mokly's deployed cleanup behavior with the retention promises in the
public Privacy Policy, and make the Terms describe the workspace-deletion path
users can actually take today. Main renamed organizations to workspaces; the
completed milestones keep the older word.

This plan was created while the reviewed legal-site commits lived on
`origin/calummoore/tripoli-v4` (`00d839e` and `67f2469`). They subsequently
merged to `origin/main` in `3d10cf4`; the implementation is synchronized with
that legal baseline and the later infrastructure and Mokly package upgrades.

## Boundaries

- Implement retention option C: disclose exact retention behavior and schedule
  the cleanup needed to make the policy true.
- Implement workspace-deletion option B: direct workspace deletion to a
  monitored Mokly contact until a separately designed product flow exists.
- Successful publications and their files remain until their project or
  workspace is deleted, whatever their age, branch or pull request state. The
  user approved this on 2026-10-31 in place of the 30-day expiry of ready
  publications that Milestones 1–5 implemented.
- Publication cleanup needs only Postgres and file storage and never reads
  GitHub. It runs daily in production and main preview, whatever
  `github.enabled` is. PR previews keep their rule of no publication
  maintenance job, because their principals cannot list the bucket; prefix
  cleanup removes their objects with the namespace database.
- Cleanup commands are bounded internally, idempotent and protected from
  overlapping scheduled runs. Publication object deletion retains the existing
  24-hour grace, incarnation fence and provider soft-delete behavior.
- GitHub OAuth flow hashes are retained for one day after expiry. Terminal raw
  webhook deliveries are retained for 30 days after receipt. Pending or leased
  deliveries are never removed by retention. GitHub pruning is database-only
  in every environment.
- Build and build-log pruning from main stays unchanged.
- This change does not add workspace-deletion UI. That needs its own protocol,
  mockup and implementation change.

## Milestone 1: Retention And Legal Contract

Define the complete behavior before changing cleanup code or deployment.

- [x] Create this plan and add it to `plans/README.md`.
- [x] Synchronize the reviewed legal-site baseline with the current
      unified-domain implementation without dropping either change.
- [x] Update `docs/protocol/cloud/retention.md` with the authoritative GitHub adapter,
      complete maintenance-cycle behavior, daily schedule, failure safety,
      30-day publication threshold, 24-hour object grace and provider
      soft-delete boundary.
- [x] Update `docs/protocol/cloud/persistence-boundaries.md` with one-day expired OAuth
      flow retention and 30-day terminal webhook-delivery retention, including
      the rule that active queue states are never pruned.
- [x] Update `docs/protocol/cloud/site-legal.md`, the Privacy Policy and the Terms so
      they state the exact schedules, delayed object deletion and contact-based
      organization-deletion path without promising immediate erasure.
- [x] Update the relevant root, crate and operations READMEs and environment
      documentation so callers and operators can find the commands, settings
      and ownership boundaries.
- [x] Run focused Markdown, legal-content and link validation and inspect the
      documentation diff.

## Milestone 2: GitHub Record Cleanup

Add database-only cleanup for expired OAuth flow hashes and terminal raw
webhook deliveries.

- [x] Add failing service and Postgres tests that prove expired OAuth flows and
      old terminal deliveries are removed while live flows and
      pending/processing deliveries survive.
- [x] Add typed store query methods and a forward migration/index for bounded
      terminal-delivery cleanup; regenerate and verify the Diesel schema and
      migration lock.
- [x] Add a trait-backed GitHub retention service with injected store and clock,
      typed retention settings, committed row-count reporting and idempotent
      behavior.
- [x] Expose a database-only `prune-github` API binary command and cover CLI
      parsing, invalid settings, successful counts and failure exit behavior.
- [x] Run the focused configuration, store and API tests plus formatting,
      Clippy and Rust file-length checks for the changed crates.

## Milestone 3: Authoritative Publication Cleanup

Compose the existing retention and garbage-collection workers into a complete,
deployable maintenance cycle.

- [x] Add failing tests for a live GitHub protection adapter that resolves the
      project's connected installation, refreshes the installed repository's
      default branch, pages all open pull requests and treats every incomplete
      or failed provider snapshot as unavailable.
- [x] Implement the adapter behind `RepositoryProtection`, with provider calls
      outside database transactions and per-batch project snapshot reuse.
- [x] Add a trait-backed maintenance runner that exhausts retention and object
      continuations, aggregates counts, rejects stalled continuations and leaves
      failed deletions retryable.
- [x] Add failing runner tests covering more than one publication batch, more
      than one object page, empty runs, provider unavailability and retryable
      collection failure.
- [x] Add narrowly validated publication-maintenance configuration and an API
      binary `maintain-publications` command that composes Postgres, GitHub and
      configured file storage without loading mail credentials.
- [x] Extend the real Postgres/local-store maintenance smoke to execute the
      complete runner and prove protected bytes remain readable while expired,
      cascaded and orphaned bytes are reclaimed.
- [x] Update the publication, API and configuration crate READMEs with the real
      command and integration boundary.
- [x] Run all focused publication, GitHub provider, configuration, store and API
      tests plus formatting, Clippy and Rust file-length checks.

## Milestone 4: Scheduled Deployment And Operations

Schedule both cleanup families and make scheduling drift test-visible.

- [x] Add daily, non-overlapping Helm CronJobs for `prune-github` and
      `maintain-publications`, with deadlines, zero retries, API workload
      identity and only the secrets each command needs.
- [x] Add chart values and validation for both schedules and retention windows;
      update complete golden renders for production, main preview and PR preview.
- [x] Add Helm regression assertions that fail if either cleanup command,
      schedule, storage setting, GitHub credential mount, deadline or
      concurrency policy disappears.
- [x] Update the shared bootstrap-hook inventory test for the conditional,
      App-key-only publication maintenance SecretProviderClass.
- [x] Update `docs/ops/maintenance.md`, deployment/environment guides and
      infrastructure README with manual-run, diagnostics, retry and provider
      outage procedures.
- [x] Render and lint every environment, run infrastructure tests, and smoke the
      commands against isolated Postgres and local object storage.

## Milestone 5: Verification, Commit, Push And Review

Prove the stacked change as one complete implementation and then perform the
required read-only review.

- [x] Run every relevant focused test with a 100% pass rate, including legal
      site content/build/browser checks, Rust unit/integration tests, maintenance
      smoke tests and Helm golden/contract tests.
- [x] Run `cargo fmt --all -- --check`, Clippy for changed Rust crates,
      `cargo xtask rust-file-length-lint --all`, then `cargo xtask check`; fix
      every failure before continuing.
- [x] Inspect `git diff origin/main...`, confirm every new file is tracked and
      verify the complete diff contains both legal wording fixes and both
      scheduled cleanup families.
- [x] Run `git add -A`, commit the completed work with a Conventional Commit and
      push the current branch.
- [x] After the push, use `docs/implementation-review-prompt.md` to review the
      complete local diff against `origin/main`; report numbered findings with
      severity, impact, lettered options and a recommendation, without changing
      the implementation.

## Milestone 6: Successful Publication Retention Contract

On 2026-10-31 the user approved keeping every successful publication until its
project or workspace is deleted. This replaces the 30-day expiry of ready
publications in completed Milestones 1–5. GitHub record pruning, abandoned and
failed attempt cleanup, expired access grants and unused-file collection
remain. The branch also takes `origin/main` at `cdf9c9e5`. Main renamed
organizations to workspaces and added cloud builds, project-scoped blobs and
build pruning.

Depends on: Milestone 5.

Decisions and design calls, all on 2026-10-31:

- User decision: ready publications have no age-based expiry and stay until
  project or workspace deletion. Rejected: the 30-day expiry that kept only
  default-branch, open-pull-request and latest-branch publications, using live
  GitHub state. Reason: shared URLs and history stay available, and cleanup
  needs no GitHub reads or credentials.
- User decision: keep this plan and the `plans/README.md` index, with Active
  and Completed sections, and link the index from the root README. This
  overrides the shared `plans` skill. End this plan with a commit and push,
  then a read-only review with `docs/implementation-review-prompt.md` that
  reports findings without changing the implementation.
- Design call: the workload-settings table in `docs/ops/environment.md`
  writes two markers in one cell for `MKC_ENV`, `MKC_FILE_STORE` and
  `MKC_GCS_BUCKET`. Their targets are the union. The API and the catalogue read
  these settings everywhere; only stable maintenance also reads them. Rejected:
  a second row for the same setting, which the parity check forbids.
- Design call: the deployment runbook states that daily maintenance deletes
  the orphaned objects of a reset database after 24 hours. Reason: operators
  must know this before they restore a database.

- [x] Update `docs/protocol/cloud/retention.md`. Keep every ready publication until
      project or workspace deletion. Define cleanup as abandoned-attempt
      deadline recovery, failed-attempt eligibility 30 days after creation,
      expired-grant removal and unreferenced and orphan collection. Keep
      `expired` as a terminal state that no scheduled job enters. Schedule the
      daily job in production and main preview, whatever `github.enabled` is,
      with database and bucket access only. PR previews get no publication
      maintenance job.
- [x] Update `docs/protocol/cloud/persistence-boundaries.md`,
      `docs/protocol/cloud/site-legal.md`, the Privacy Policy and the Terms. State
      database-only GitHub pruning in every environment, successful-publication
      retention, failed-attempt eligibility, no anonymization claim and
      contact-based workspace deletion.
- [x] Update the operations guides, the environment settings inventory, the
      architecture doc, the other protocol docs that described ready expiry,
      and the root, infrastructure and crate READMEs.
- [x] Restore the `plans/README.md` index of every plan file, with Active and
      Completed sections, and link it from the root README.
- [x] Recreate `docs/implementation-review-prompt.md` as the read-only,
      report-only review prompt for Milestone 8.

Evidence: `.context/privacy-retention-alignment/docs-report.md`.

## Milestone 7: Preserve Successful Publications And Simplify Cleanup

Remove the scheduled expiry of ready publications and its GitHub dependency,
and integrate main.

Depends on: Milestone 6.

- [x] Merge `origin/main` at `cdf9c9e5` and resolve every conflict. Keep main's
      features and this branch's GitHub record cleanup.
- [x] Add failing unit, Postgres and running-catalogue regressions. They prove
      that old successful publications keep their file references, URLs and
      same-head idempotency through maintenance, also with a successful
      history larger than one batch.
- [x] Exclude ready publications from the candidate query and the worker.
      Replace the ready-and-failed age index with a failed-only index in a new
      forward migration. Keep the historical expired state and its query-level
      coverage.
- [x] Remove the GitHub protection adapter and the maintenance GitHub provider,
      settings and secret mount. Keep the serving GitHub integration and the
      database-only `prune-github` command.
- [x] Rename the unmerged GitHub retention migration to
      `202610311201_github_retention`, so that its lock entries sort after
      main's. Keep its SQL unchanged.
- [x] Schedule publication maintenance daily in production and main preview,
      whatever `github.enabled` is, with database and storage access only.
      Render no publication maintenance in PR previews. Regenerate the Helm
      golden renders.
- [x] Accept several markers in one cell of the runtime-settings parity check.
- [x] Return `apps/site/tests/legal.test.ts` to main's version. The branch
      version only matched legal prose with regular expressions.
- [x] Exercise abandoned and failed cleanup, expired grants, shared references,
      parent deletion, the 24-hour grace, orphan deletion and retry behavior.

Evidence: `.context/privacy-retention-alignment/merge-decisions.md`.

The merged working tree is conflict-free and the implementation is complete.
Milestone 8 records the merge commit after the complete gate passes.

## Milestone 8: Revised Verification, Commit, Push And Review

Verify and publish the revised branch, then review its complete final diff.

Depends on: Milestones 6 and 7.

- [x] Run an independent options check of the approved policy and integration
      choices. Report its cleanup-wording finding with the final review,
      without applying a fix automatically.
- [x] Run the focused tests, the real Postgres, local-storage and catalogue
      smoke, Rust formatting and Clippy, the Helm checks and the Markdown and
      site checks.
- [x] Run `cargo xtask check`. Confirm that the complete diff against
      `origin/main` contains every required file and only authorized
      removals.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [x] After the push, review the complete diff against `origin/main` with
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.

Evidence: `.context/privacy-retention-alignment/plan-options-report.md`.
Full gate: `.context/privacy-retention-alignment/full-gate-final.log`.
Review: `.context/reviews/calummoore/beijing-v3/findings.md`.

Implementation commit `a577ea0a` is pushed. All 25 gate stages passed. The
post-push review and three independent finding checks confirmed two Medium
findings and one Low finding. They await the user's decisions; no review fix
was applied. The follow-up records include the additional capacity and
coverage notes and the two existing issues outside this change's scope.

## Milestone 9: Merge The Latest Main

Integrate main at `bdbf7a58`, as the user requested on 2026-11-01. Keep the
retention behavior and the existing review findings unchanged.

Depends on: Milestone 8.

- [x] Merge `origin/main`. Keep its archived plans, follow-up records,
      documentation changes and mockup parity tests.
- [x] Resolve the root README conflict. Keep the current plan index with
      Active and Completed sections, and preserve main's follow-up link.
      Link the previous index to its archived revision.
- [x] Run the complete gate and the preservation and deletion audits.
- [x] Commit the merge and push the branch.
- [x] Run the read-only post-push review. Report findings without applying
      fixes automatically.

Evidence: `.context/privacy-retention-alignment/main-sync-20261101/`.

Merge `64c63c93` is pushed. All 25 gate stages passed. The read-only review
found no lost code. Two independent checks confirmed a Medium GitHub test gap
and a Low protocol-placement issue. They await user decisions, with A and C
recommended. The earlier three findings remain open. No review fix was applied.

The GitHub test creates no live OAuth flow. This limits the live-flow coverage
claim in the completed Milestone 2. The new follow-up records the missing
proof without rewriting that milestone's history.

## Milestone 10: Merge The Later Documentation Update

Main advanced to `206a581d` while verification and review ran. Integrate its
README cleanup without changing retention behavior or applying review fixes.

Depends on: Milestone 9.

- [x] Merge the later main commit. Preserve its removal of archived plan
      references and its documentation changes.
- [x] Resolve the root and docs README conflicts. Keep the user's required
      root plan-index link and the report-only review prompt. Preserve main's
      removal of the other plan and follow-up references.
- [x] Run the documentation-only checks and preservation audits. Confirm
      every non-Markdown file matches the tree that passed the full gate.
- [x] Commit the merge and push the branch.
- [x] Review the documentation integration without applying fixes.

Evidence: `.context/privacy-retention-alignment/main-sync-20261101/second-main/`.

## Milestone 11: Integrate The Captured ESLint Update

Main advanced again to `40136d81`. Use this revision as the limit for this
synchronization. Keep the earlier review findings open.

Depends on: Milestone 10.

- [x] Merge `40136d81` without conflicts. Preserve all incoming lint settings,
      source checks, documentation and follow-up records.
- [x] Check the incoming file inventory and confirm that the existing
      retention implementation stays unchanged.
- [x] Run the broader ESLint check and the complete gate on the combined tree.
- [x] Commit and push both later main integrations.
- [x] Review the final integration without applying review fixes.

Evidence: `.context/privacy-retention-alignment/main-sync-20261101/final-main/`.

Merge `0db8b7d5` is pushed. The complete gate passed all 25 stages again.
The final read-only review found no new integration issue and no lost code.
The five existing review findings remain open. No review fix was applied.

## Milestone 12: Merge Main On 2026-11-04

Integrate captured main `08b3a98b`, including the released Mokly 0.18 upgrade,
viewer fixes and infrastructure updates. Preserve successful-publication
retention and the five deferred follow-ups. Do not apply their fixes.

Depends on: Milestone 11.

- [x] Merge the captured main revision. Resolve the migration lock, retention
      test imports and deployment reset description without losing behavior.
- [x] Rename the unmerged candidate-index and GitHub migrations to
      `202611041200_failed_publication_retention` and
      `202611041201_github_retention`. Keep their SQL unchanged and preserve
      every immutable main migration and checksum.
- [x] Verify retention with main's current package contracts. Preserve the
      moved slug-destination tests and child-table retention coverage.
- [x] Run the complete gate and audit both branches' preserved content.
- [x] Commit and push the merge. Run a read-only review.

Evidence: `.context/privacy-retention-alignment/main-sync-20261104/`.

Merge `bacbe0cb` is pushed. All 25 local gate stages passed. The independent
review found no new integration issue and no lost behavior. The five
deferred follow-ups remain unchanged. Watch CI for the final pushed commit
and record its outcome in the PR description and verification evidence.

## Post-merge follow-up (non-blocking)

On 2026-11-02, the user deferred all five confirmed review findings to
separate work after this PR merges. This supersedes their earlier open
status. The recommendations remain proposals. The user did not select an
implementation option or approve a new requirement.

- [Cleanup grace wording](./follow-ups/cleanup-grace-wording-conflates-orphan-age.md)
  — Medium. Recommend D: qualify the public delay and link the canonical rule.
- [Independent collection continuations](./follow-ups/gc-continuations-lack-independent-regressions.md)
  — Medium. Recommend E: test each continuation signal and its producer.
- [GitHub cleanup survivor assertions](./follow-ups/github-prune-tests-miss-row-identities.md)
  — Medium. Recommend A: check surviving rows and add a live OAuth flow.
- [Disabled GitHub settings wording](./follow-ups/disabled-github-copy-includes-cleanup-settings.md)
  — Low. Recommend C: correct both guides and the setting inventory.
- [Retention protocol mechanics](./follow-ups/retention-protocol-restores-test-mechanics.md)
  — Low. Recommend C: state the selection-cost requirement and remove mechanics.
  Approve any new requirement when that work starts.
- Design workspace deletion as a settings pane, update desktop/mobile mockups
  and then expose the already-supported API operation through the app.
