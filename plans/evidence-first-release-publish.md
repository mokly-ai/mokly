# Evidence-First Release Publish

Stop re-running the complete `cargo xtask check` gate inside the npm publish
job when successful CI evidence already exists for the exact tree being
published. The publish job keeps every check that CI does not perform (tag
identity, live audit, exact-artifact packing and smoke, registry guards and
provenance) and falls back to the complete gate whenever applicable evidence is
absent. This is option C from the 22 September 2026 release investigation.

## Findings that shape the design

- The publish job checks out the immutable `vX.Y.Z` tag and runs
  `cargo xtask check` serially on one Node 24 runner with zero retries
  ([`release.yml`](../.github/workflows/release.yml)). The release PR's CI had
  already verified the same tree in 20 parallel jobs on Node 22.14.0, Node 24,
  macOS and Windows, so publish verifies a strict subset of what CI verified.
- Measured on the v0.12.0 release (run 35715835822): PR #87 CI took 15m10s to
  `Required CI`; publish attempt 1 failed after 17m on one flaky unit test
  (`plain Serve with piped stdin exits promptly on SIGINT`); attempt 2 spent
  45m in `Run complete verification` and 8m in every other step combined. The
  release merged at 10:24 UTC and published at 12:12 UTC.
- The squash-merge commit `448f110` and PR #87's head `238083e` have the same
  tree `3a38f3ca…`. CI reports for a `pull_request` run record `GITHUB_SHA`,
  which is GitHub's synthetic merge commit (`b24a8a4` for PR #87). That commit
  is not fetchable through `git` after the merge, but
  `GET /repos/{repo}/git/commits/{sha}` returns it with its tree, so tree
  identity between the evidence commit and the tag commit can be proven
  through the REST API without trusting a status name.
- The 16 `verification-*` report artifacts already carry the commit, runtime,
  exact Node version, shard, complete and observed inventories, per-test
  outcomes and process exit evidence
  ([`ci-verification.md`](../docs/protocol/ci-verification.md)). They are
  retained for 14 days and are validated by
  [`aggregate.mjs`](../scripts/verification/aggregate.mjs), which can be
  reused unchanged by the publish job.
- The push CI run on the release commit itself failed because browser shard 3
  on Node 24 picked up Node 24.21.0 while its siblings ran 24.20.0. Evidence
  selection therefore cannot assume the push run exists; the PR run is the
  usual evidence.
- The live workspace audit (`npm run dependencies:check`) is time-sensitive
  and is the one gate whose value depends on running at publish time
  ([`dependency-security.md`](../docs/protocol/dependency-security.md)). It
  takes seconds and must keep running in every publish.
- The publish job's `GITHUB_TOKEN` has only `contents: read` and
  `id-token: write`. Listing runs, jobs and artifacts and downloading artifact
  zips requires `actions: read`.

## Decisions

1. **Two verification modes.** `evidence` (default for release pushes and
   manual dispatches) consumes CI evidence; `complete` (manual dispatch input)
   always runs `cargo xtask check`. `complete` is the maintainer escape hatch
   for retries after an evidence defect or when a full re-run is wanted.
2. **Evidence identity is the tree, not a status.** Applicable evidence is a
   successful same-repository CI workflow run whose `Required CI` job
   succeeded and whose unexpired `verification-*` reports, revalidated with
   the existing aggregate, name one commit that is the tagged commit or has
   the tagged commit's tree. Candidates are the `push` run for the tagged
   commit and the `pull_request` runs for the head of any merged pull request
   whose merge commit is the tagged commit, newest first.
3. **Fallback is the complete gate, never a skipped check.** No candidate,
   expired or missing artifacts, a tree mismatch, a non-successful run, and
   any REST transport failure all classify as `absent` and run
   `cargo xtask check` exactly as today. Evidence whose identity matches but
   whose content fails validation classifies as `invalid` and fails the job,
   because that signals a defect in the evidence pipeline rather than missing
   data.
4. **Publish always audits live.** `npm run dependencies:check` runs in every
   publish before packing; the packed-consumer production audit inside the
   artifact smoke is unchanged. In `complete` mode the gate's own audit-first
   order still applies.
5. **The evidence record is release evidence.** Publish writes
   `.context/release-evidence/record.json` (mode, tagged commit, tree,
   selected run id and URL, evidence commit, report count, reason) and
   preserves it beside the checked artifacts.
6. **Artifacts are downloaded through the REST API, not a second action.**
   The script lists artifacts, follows the `zip` redirect without forwarding
   the token to the blob host, and extracts with the runner's `unzip` through
   an injected command runner so unit tests need no network or archive.
7. **Rust and Chromium installs become conditional on `complete` mode.** They
   serve only `cargo xtask check`; pack, smoke and registry steps are Node
   only.

## Out of scope (separate plans)

- Pin the CI matrix's floating `"24"` Node entry to an exact version so a Node
  minor release cannot land mid-run and fail the shard aggregate.
- Make `plain Serve with piped stdin exits promptly on SIGINT` robust to a
  null exit code on loaded runners.

## Milestone 1: Protocol And Documentation Contract

Summary: define the evidence-first publish contract in the protocol docs so
Milestones 2 and 3 have no open questions, and register the plan.

- [x] Create `docs/protocol/npm-release-evidence.md` (~120 lines) covering:
      the two verification modes and how each event selects one; the candidate
      run rules from Decision 2 including the REST endpoints
      (`actions/workflows/ci.yml/runs`, `commits/{sha}/pulls`,
      `actions/runs/{id}/jobs`, `actions/runs/{id}/artifacts`,
      `actions/artifacts/{id}/zip`, `git/commits/{sha}`); the identity proof
      (reports agree on one commit; that commit equals the tagged commit or
      its REST tree equals `git rev-parse HEAD^{tree}`; unit report
      inventories equal live `discoverUnitFiles` on the tag checkout); the
      `applicable`, `absent` and `invalid` outcomes and which conditions map to
      each; the always-run live audit; the evidence record schema and
      location; the `actions: read` token permission; and the expected timing
      (about 10 minutes in evidence mode versus 54 minutes measured today).
- [x] In [`npm-release.md`](../docs/protocol/npm-release.md): replace step 5
      of `## Release Management` with the audit-then-evidence-or-complete
      sequence and link the new doc; add the `verification` dispatch input to
      the manual-retry paragraph; add `actions: read` to the publish
      permissions sentence; extend `## Release Evidence` with the verification
      mode and referenced CI run; keep `## Local Verification` describing
      `cargo xtask check` as the complete local gate and the `complete`
      publish mode.
- [x] In [`ci-verification.md`](../docs/protocol/ci-verification.md)
      `## Verification Boundary` and `## Inventory And Report Evidence`, state
      that the validated aggregate of all sharded reports is complete
      verification of the tree they name, that the release evidence contract
      consumes it, and that the 14-day retention bounds evidence availability.
- [x] In [`dependency-security.md`](../docs/protocol/dependency-security.md),
      replace "The release workflow retains that complete audit-first command"
      with the always-live publish audit rule from Decision 4.
- [x] In [`docs/protocol/README.md`](../docs/protocol/README.md), list the new
      doc beneath the CI and npm release contract entry.
- [x] Add this plan to `plans/README.md` under Active.
- [x] Run `npx prettier --check` on the changed Markdown and review the diff.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report
      findings without changing the implementation.

## Milestone 2: Evidence Selection Scripts

Summary: implement the evidence contract as testable release scripts that are
not yet wired into the workflow, so the repository stays releasable through the
existing complete path.

- [x] Add `scripts/release/evidence_contract.mjs` with pure functions:
      `selectCandidateRuns(runs, pulls, tagCommit, repository)` returning
      same-repository successful CI runs ordered push-for-tag first, then
      merged-PR head runs newest first; `classifyEvidence(...)` returning
      `{ outcome: "applicable" | "absent" | "invalid", reason }` from the run,
      the `Required CI` job, artifact expiry, the reports' single commit, the
      tree comparison and the live unit inventory; and
      `resolveVerificationMode({ eventName, manualVerification })` (push →
      `evidence`; dispatch → `evidence` or `complete`, rejecting other values).
- [x] Add `scripts/release/evidence_github.mjs` with an injectable
      `{ fetch, execute, write }` client: JSON requests with the workflow
      token, pagination-free bounded listings (`per_page=100`), artifact zip
      download that follows the redirect without an `Authorization` header on
      the blob host, and `unzip -o -q` extraction into
      `.context/release-evidence/reports/<artifact>/`. Transport failures
      return a typed `absent` reason instead of throwing.
- [x] Add `scripts/release/evidence.mjs` entrypoint: reads
      `RELEASE_VERIFICATION`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY` and
      `GITHUB_SERVER_URL`; resolves the tagged commit from `HEAD`; in
      `evidence` mode selects, downloads, revalidates with
      `validateCiReports` and `readReports` from
      [`aggregate.mjs`](../scripts/verification/aggregate.mjs) and
      `discoverUnitFiles` from
      [`evidence.mjs`](../scripts/verification/evidence.mjs); writes
      `.context/release-evidence/record.json`; writes the `mode` workflow
      output (`evidence` only for `applicable`, otherwise `complete`); exits
      non-zero only for `invalid` or usage errors. Keep each file under 200
      lines.
- [x] Add `scripts/release/evidence_record.mjs` so Git identity and release
      record persistence stay independently testable without pushing the
      evidence entrypoint beyond the plan's 200-line target.
- [x] Add typed module declarations for the evidence scripts consumed by the
      TypeScript contract tests.
- [x] Add `tests/release_evidence.test.ts` covering: mode resolution for push
      and dispatch inputs; candidate ordering and exclusion of forks, other
      workflows, failed runs and runs whose `Required CI` job is not
      `success`; expired or missing artifacts → `absent`; tree mismatch →
      `absent`; REST 5xx and network errors → `absent` with reason; reports
      naming two commits or failing the aggregate → `invalid` throws; the
      redirect download never resends the token; the record JSON shape and
      the `GITHUB_OUTPUT` line; `complete` mode performs no requests.
- [x] Add `tests/release_evidence_contract.test.ts` that asserts the script's
      `Required CI` job-name constant and `verification-*` artifact pattern
      match [`ci.yml`](../.github/workflows/ci.yml) so a rename cannot
      silently turn every publish into `absent`.
- [x] Real-API smoke before merge: in a detached worktree at `v0.12.0`, run
      `GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=mokly-ai/mokly RELEASE_VERIFICATION=evidence node scripts/release/evidence.mjs`
      and confirm it selects PR #87's run 35714338596, downloads 16 reports,
      proves tree `3a38f3ca…` and reports `applicable` (after 6 October 2026
      the artifacts expire and the expected outcome becomes `absent` with the
      expiry reason; record whichever was observed).
      Observed `applicable` on 22 September 2026: run 35714338596 supplied 16
      reports naming `b24a8a49…`, whose tree matched tag tree `3a38f3ca…`.
- [x] Run the new tests, `npm run lint`, `npm run format:check`, then the
      complete `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report
      findings without changing the implementation.

## Milestone 3: Release Workflow Integration

Summary: wire the evidence scripts into `release.yml`, keep every publish
guard, and prove the workflow contract with tests.

- [x] In [`release.yml`](../.github/workflows/release.yml): add the
      `workflow_dispatch` input `verification` (`type: choice`, options
      `evidence` and `complete`, default `evidence`); pass it through
      `select-release` as a `verification` output resolved by
      [`resolve-ref.mjs`](../scripts/release/resolve-ref.mjs) with
      `resolveVerificationMode`; set the publish job env
      `RELEASE_VERIFICATION` from that output.
- [x] Add `actions: read` to the publish job permissions and pass
      `GITHUB_TOKEN: ${{ github.token }}` only to the evidence step.
- [x] Reorder publish steps to: verify tags → `npm ci` →
      `Audit workspace dependencies` (`npm run dependencies:check`) →
      `Select verification evidence` (`id: evidence`) → `Set up Rust` and
      `Install Chromium` with `if: steps.evidence.outputs.mode != 'evidence'`
      → `Run complete verification` with the same condition → the unchanged
      pack, smoke, recheck, preserve, guard, publish and verify steps. Add
      `.context/release-evidence/record.json` to the preserved artifact paths.
- [x] Update [`tests/release.test.ts`](../tests/release.test.ts): publish
      permissions equal `{ actions: read, contents: read, id-token: write }`;
      the dispatch input exists with the exact choices and default; the audit
      step precedes evidence selection, which precedes the three conditional
      steps, which precede packing; the three conditional steps share the
      negative-form condition so a missing output runs the complete gate; the
      token reaches only the evidence step; the preserved paths include the
      record; every action remains pinned to a commit hash.
- [x] Extend [`tests/release_refs.test.ts`](../tests/release_refs.test.ts)
      or the context tests for `resolve-ref.mjs` writing the `verification`
      output for push and dispatch events and rejecting an unknown value.
- [x] Update [`xtask/README.md`](../xtask/README.md) only if its release
      wording changes; confirm the root README's complete-gate guidance is
      still accurate. No update was needed: both documents already describe
      the unqualified command as the complete local gate.
- [x] Run the workflow and release tests, `npm run lint`,
      `npm run format:check`, then the complete `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and report
      findings without changing the implementation.

## Post-merge follow-up (non-blocking)

- Observe the first release-please merge after this change: confirm the
  publish job reports `applicable`, skips `Run complete verification`, and
  finishes in roughly 10 minutes; attach the run URL and the preserved
  `record.json` to the plan's completion note.
- Dispatch the release workflow from `main` for the same tag pair with
  `verification: complete` to prove the fallback path and the
  already-published skip behave together.
- Record the observed evidence-mode timing in the `## Release Evidence`
  section of `npm-release.md` alongside the pre-change measurement.
