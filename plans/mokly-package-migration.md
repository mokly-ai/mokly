# Mokly Package Migration

Migrate the repository's public distribution identity from `mokabook` to the
unscoped `mokly` npm package and executable. There are no supported external
Mokabook consumers, so the cutover is intentionally breaking and does not ship
a compatibility package, alias executable, or dual config discovery.

The existing `mokabook` registry package remains reserved after cutover and is
deprecated only after `mokly` has been published and verified. Historical Git
tags, changelog entries, and review evidence remain history; current repository
metadata and release provenance move to `mokly-ai/mokly`.

## Milestone 1: Distribution And Protocol Contract (Completed)

Summary: define the exact public rename and the one-time npm bootstrap sequence
before changing implementation behavior.

- [x] Specify `mokly` as the package and executable, `mokly.config.*` as config
      discovery, and the renamed generated/public identifiers that consumers
      can observe.
- [x] Document that old Mokabook inputs are rejected rather than silently
      supported, while historical release records remain intact.
- [x] Document npm organization access, first-package bootstrap, trusted
      publishing for `mokly-ai/mokly`, legacy package deprecation, and release
      verification.
- [x] Update current README and protocol links for the new product identity.

## Milestone 2: Canonical Design Rebrand (Completed)

Tags: mockup

Summary: rename the checked design catalogue before changing the served product
shell that implements it.

- [x] Update canonical design catalogue source copy and metadata from Mokabook
      to Mokly without changing unrelated screen behavior.
- [x] Regenerate checked catalogue HTML and manifests from source.
- [x] Run design, generated-output, type, and browser smoke checks for every
      changed canonical page.

## Milestone 3: Package, CLI, And Runtime Cutover (Completed)

Summary: make installed consumers use only the new package, executable, config,
and generated-output contract.

- [x] Add failure-first assertions for the `mokly` package metadata, binary,
      repository URLs, config discovery, import resolution, and packed install.
- [x] Rename public TypeScript identities and consumer examples to Mokly.
- [x] Rename config discovery, generated artifacts, owned metadata, local
      directories, diagnostics, and static runtime identifiers without public
      Mokabook aliases; retain only narrowly scoped historical Git and ownership
      readers needed to compare or replace committed output safely.
- [x] Update clean packed-consumer fixtures and package inspection to prove the
      new import and `npx mokly` behavior.
- [x] Keep implementation files within repository size limits and update nearby
      README guidance.

## Milestone 4: Served Product Rebrand (Completed)

Tags: ui

Summary: align the actual Browse, Review, and export surfaces with the canonical
Mokly design while leaving feature behavior unchanged.

- [x] Replace user-facing Mokabook product copy, accessibility names, titles,
      status output, and shell-owned selectors with Mokly equivalents.
- [x] Update client/server route contracts and static delivery tests together.
- [x] Smoke Browse, Review, watch, build, check, and export through the `mokly`
      executable.

## Milestone 5: Release Automation And Complete Verification (Completed)

Summary: prepare the repository side of the first unscoped `mokly` publication
and prove the complete product remains releasable.

- [x] Update release artifact naming, registry guards, workflow tests, and
      maintainer setup for `mokly` and `mokly-ai/mokly`.
- [x] Run formatting, lint, typecheck, unit/integration tests, browser tests,
      package/tarball smokes, and relevant platform-independent smoke tests with
      a 100% pass rate.
- [x] Run `cargo xtask check` and require a 100% pass rate.
- [x] Record the remaining authenticated npm/GitHub/Cloudflare maintainer steps
      that cannot be completed from the workspace without credentials.

## Milestone 6: Commit And Push (Completed)

Summary: publish the complete reviewed workspace change to the current branch.

- [x] Inspect the complete diff against `origin/main` and ensure every generated
      and newly created file is tracked.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the current
      branch without renaming it.

Delivered in `96a7ca6` (`feat!: rename package to Mokly`), pushed to
`calummoore/minnetonka-v4`.

## Milestone 7: Post-Push Implementation Review (Completed)

Summary: review the exact pushed result without changing implementation.

- [x] After the push, use
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report every
      finding and recommendation without applying fixes.

The review identified historical style-offset corruption, missing bootstrap
commit evidence, unconfigured GitHub publishing protections, and stale delivery
checkboxes. The user authorized these follow-up fixes separately.

## Milestone 8: Review Follow-Up Corrections (Completed)

Summary: preserve historical comparison coordinates, tie the bootstrap archive
to its reviewed source, and make publishing protection requirements actionable.

- [x] Add failure-first historical marker/style tests for Review and Changes;
      parse old boundaries without rewriting coordinate-bearing HTML and retain
      original snapshot bytes. Update the component comparison contract.
- [x] Add failure-first bootstrap tests for dirty and wrong source commits,
      isolated clean builds, and commit/integrity evidence. Provide a dedicated
      archive command and update the bootstrap contract and README.
  - [x] Cover symlinked temporary roots (including the macOS path-alias case)
        without losing source-root validation or temporary-build cleanup.
- [x] Configure and read back the GitHub `npm` environment and immutable `v*`
      tag protections, or record an authenticated API blocker with exact
      maintainer setup and verification commands. Allow workflow ref `main`,
      not the tag checked out inside the publish job.
- [x] Correct the original delivery and review records without reopening
      completed milestones.

GitHub setup is externally blocked: two attempts each to update environment
`npm` and create the immutable-tag ruleset returned HTTP 403 `Resource not
accessible by integration`. Read-back confirms the environment still has no
protection rules and administrator bypass enabled, the ruleset list is empty,
and `main` is protected. An authorized maintainer must complete and verify
[`npm-github-protections.md`](../docs/protocol/npm-github-protections.md) before
publishing. No npm publication or protection change occurred in this workspace.

## Milestone 9: Mainline Design Preservation (Completed)

Tags: mockup

Summary: preserve the catalogue-navigation design merged to `main` in `83b377a`
after this branch's original `96a7ca6` delivery. The captured pre-merge source
tip is `96a7ca66ba89e24017152368e2154e75230e9f9a`; its merge base with the new
main is `e0dc6d10163e79e0b991d1cd25b53778810dffe7`.

- [x] Audit the upstream additions, keep the separate Pages/Components design
      and its tests/docs, and resolve branded imports/copy path by path.
- [x] Regenerate conflicted artboards from the integrated source; retain the
      new section helper and all existing source and generated routes.
- [x] Verify design examples and smoke the generated mobile/desktop navigation.

All 69 regenerated pages opened directly from disk with no page errors; their
desktop/mobile captures were visually inspected. A normalized comparison of all
41 upstream source/test/style/doc files confirms every mainline change is
preserved; only the authorized rename/formatting and README release guidance
differ. No mainline feature or test is removed.

## Milestone 10: Mainline Product Preservation (Completed)

Tags: ui

Summary: preserve the already-approved navigation feature in the served shell.

- [x] Keep section projections, disclosure state and live-update behavior from
      `main`; carry the Mokly rename into its newly added selectors and fixtures.
- [x] Run the navigation and browser regression tests, including the upstream
      section tests and Changes continuity tests.

## Milestone 11: Combined Verification (Completed)

Summary: verify the fixes together with current main before delivery.

- [x] Run focused regressions, packaging smoke checks, and `cargo xtask check`
      with every check passing.
- [x] Smoke the dedicated bootstrap CLI against the clean committed result
      before pushing; never publish the smoke artifact.
- [x] Capture and fix partial-clone packing: a full clone attempts to transfer
      unavailable historical blobs even when the reviewed tree is complete.
      Fetch only the explicit reviewed commit into the isolated checkout, prove
      this with a real filtered-clone fixture, and rerun `cargo xtask check`.

The first complete gate passed on Node 24.21.0: 1,037 unit/integration tests, 245
Chromium browser tests, packed consumers, generated output, dependency audit,
formatting/lint/typechecking, and Rust formatting/Clippy/tests/file-length lint.

After the partial-clone correction, the complete gate passed again with 1,038
unit/integration tests and 245 browser tests; every other gate passed too. The
revised packer also built the real 1,312-file package from an isolated source
checkout before this final gate, recording its exact source commit/tree and
verified archive hashes.

The dedicated CLI then passed against clean commit
`aeb9a26c510621dbc37b1a8a84552ec42bfa2736`, producing `mokly@0.8.0` with 1,312
files and source tree `e439048cc833005c848dde196ba9094ecf091cb9`. The tarball and
matching source/hash report are retained under
`.context/bootstrap-smoke-aeb9a26/`; nothing was published.

## Milestone 12: Follow-Up Commit And Push (Completed)

Summary: publish the checked follow-up on the existing branch.

- [x] Inspect the complete diff and newly created files, run `git add -A`,
      commit with a Conventional Commit, and push the current branch.

Commits `681db1a` and `aeb9a26` deliver the fixes and mainline preservation on
`calummoore/minnetonka-v4`. The remote branch was read back and matched
`aeb9a26c510621dbc37b1a8a84552ec42bfa2736` before review.

## Milestone 13: Follow-Up Post-Push Review (Completed)

Summary: review the complete delivered migration and follow-up without applying
new findings. Record the outcome and move this plan to the completed index in a
documentation-only closeout commit, then push and review that final diff too.

- [x] After the push, use
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report every
      finding and recommendation without applying fixes.

Reviewed the complete 808-file diff against `origin/main` at `83b377a` after the
push. The review included an identity/formatting audit of 542 non-generated
text files, focused inspection of behavioral changes and new regressions,
generated-output and source-preservation evidence, and local-link validation in
all 78 changed Markdown files. No new implementation findings were identified.

1. **P1 — External publishing protections remain unconfigured.** The release
   workflow depends on environment approval and immutable tags; the current
   workspace credential cannot apply them. Enabling npm trusted publishing
   without completing this setup would leave releases without the documented
   approval/ref protections. A: an authorized maintainer applies and verifies
   the [protection runbook](../docs/protocol/npm-github-protections.md)
   (**recommended**). B: defer publishing until such a credential is available.
   The durable fix is repository-level protection plus retained read-back
   evidence, not an npm token or a workflow-only approximation of approval.

At that review, repository work was delivered and the external setup blocker
remained explicit. No live npm publication was attempted, and the bootstrap's
macOS-style path handling was exercised through an isolated alias fixture on
Linux rather than on a Mac. That documentation-only closeout was committed and
pushed separately and received a final read-only diff review.

Post-completion status (17 September 2026): the immutable-tag ruleset and
main-only `npm` environment are configured with administrator bypass disabled.
The environment's sole-maintainer review rule was subsequently removed by
explicit maintainer decision; merging the reviewed Release Please PR now
authorizes publication without a duplicate self-approval step.
