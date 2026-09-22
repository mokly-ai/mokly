# Npm Release Verification Evidence

## Verification Modes

The npm release workflow has two verification modes. A release push and a
manual dispatch default to `evidence`. In that mode, publishing reuses complete
CI evidence for the exact Git tree at the immutable release tags. A manual
dispatch may instead select `complete`, which skips all GitHub evidence requests
and runs `cargo xtask check` in the release checkout.

Both modes run the live workspace dependency audit after `npm ci`. Evidence mode
does not treat an earlier audit as current security evidence. Complete mode then
runs the complete gate, whose first operation repeats that audit by design.

## Candidate Runs

Evidence mode uses the GitHub REST API with a token that has `actions: read` and
`contents: read`. Listings are bounded to `per_page=100`; no incomplete page is
treated as proof. The client uses these endpoints:

- `actions/workflows/ci.yml/runs` for successful push and pull-request runs;
- `commits/{sha}/pulls` for merged pull requests associated with the tag commit;
- `actions/runs/{id}/jobs` for the exact `Required CI` job result;
- `actions/runs/{id}/artifacts` and `actions/artifacts/{id}/zip` for the 16
  `verification-*` reports; and
- `git/commits/{sha}` for the tree named by an evidence commit.

Candidates must be completed, successful runs of `.github/workflows/ci.yml`
whose head repository is the release repository. Runs from forks, other
workflows, other events, or unsuccessful runs are excluded. Candidate order is:

1. a successful `push` run whose head SHA is the tagged commit; then
2. successful `pull_request` runs for the same-repository head of each merged
   pull request whose `merge_commit_sha` is the tagged commit, newest first.

Each candidate must also contain exactly one successful job named `Required CI`.
An absent or unsuccessful job makes that candidate unavailable. An unavailable
candidate is skipped so an older valid run for the same tree can still apply.

## Identity And Completeness Proof

The release checkout supplies the tagged commit with `git rev-parse HEAD` and
the tagged tree with `git rev-parse HEAD^{tree}`. The downloaded artifact names
must match the CI verification namespace, be unexpired, and yield exactly 16
reports. All reports must name one full commit SHA.

The evidence commit is applicable when it is the tagged commit or when
`git/commits/{evidence-commit}` names the tagged tree. The latter comparison is
required for pull-request CI: reports name GitHub's synthetic merge commit,
while a squash merge produces a different release commit with the same tree.
A status name, PR head SHA, or successful workflow conclusion alone never proves
release identity.

After identity is established, `validateCiReports` revalidates every runtime,
suite, shard, assignment, observed result, exit outcome, and complete inventory
defined by the [CI verification contract](./ci-verification.md). In addition,
the unit reports' complete inventory must equal `discoverUnitFiles` on the tag
checkout. This final comparison prevents reports from proving only the test
files present in another tree.

## Outcomes And Failure Semantics

Evidence selection produces one of three outcomes:

- `applicable`: a candidate passes the job, artifact, identity, aggregate, and
  live unit-inventory checks. The publish job skips Rust, Chromium, and
  `cargo xtask check` and continues with exact-artifact checks.
- `absent`: no candidate exists, a listing or download has a transport failure,
  the required job is unavailable, artifacts are missing or expired, the
  evidence commit cannot be resolved, or its tree differs from the tag. The
  workflow falls back to `complete` verification.
- `invalid`: an otherwise available report set is malformed, reports disagree
  on the commit, aggregate validation fails, or the live unit inventory differs.
  The script exits non-zero. Invalid evidence indicates a broken evidence
  pipeline and must not be hidden by a complete-gate fallback.

An `absent` result from one candidate continues to the next ordered candidate.
If none apply, its final reason is recorded before the complete fallback runs.
An `invalid` result stops selection immediately. Unknown modes and malformed
required environment are usage errors and also exit non-zero.

Artifact zip requests include the workflow token only on the GitHub API request.
The client follows GitHub's redirect to blob storage without forwarding the
`Authorization` header. Archives extract into
`.context/release-evidence/reports/<artifact>/` with `unzip -o -q`.

## Release Record

Every selection writes `.context/release-evidence/record.json`, which is
preserved beside the packed release artifacts. The JSON object contains:

- `mode`: the effective `evidence` or `complete` verification mode;
- `outcome`: `applicable`, `absent`, `invalid`, or `complete`;
- `taggedCommit` and `taggedTree`;
- `selectedRunId` and `selectedRunUrl`, or `null` when no run was selected;
- `evidenceCommit`, or `null` when no report identity was established;
- `reportCount`; and
- `reason`, a stable human-readable explanation of the decision.

The workflow output `mode=evidence` is written only for `applicable`; every
non-error fallback writes `mode=complete`. The explicit complete mode performs
no GitHub evidence requests. The record is diagnostic evidence, while the
workflow step result remains the authority for whether publishing may continue.

## Publish Boundary And Timing

Verification selection does not replace release-specific checks. Both modes
verify immutable local and remote tags, run the live audit, pack and inspect the
exact viewer and CLI archives, smoke-test clean consumers, recheck source and
tags, guard existing registry versions, publish with trusted provenance, and
verify registry bytes and attestations.

The v0.12.0 release measured about 54 minutes when complete verification was
repeated in the publish job. Evidence mode is expected to take about 10 minutes,
including the unchanged release-specific work. Artifact retention is 14 days,
so older releases normally take the complete fallback.
