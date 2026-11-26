# Npm Release Verification Evidence

## Verification Requirement

Release preparation requires applicable CI evidence for the exact Git tree at
the immutable release tags. This rule applies to automatic releases and manual
retries. Preparation never runs the complete repository gate on the release
runner. A local verification fallback was rejected because CI owns that work.

Read-only preparation runs the live npm and Rust audits after dependency
installation. It does not treat an earlier audit as current security evidence.
It installs Chromium for the packed viewer smoke.

## Candidate Runs

Evidence selection uses the GitHub REST API with a token that has `actions: read` and
`contents: read`. Listings are bounded to `per_page=100`; no incomplete page is
treated as proof. The client uses these endpoints:

- `actions/workflows/ci.yml/runs` for successful push and pull-request runs;
- `commits/{sha}/pulls` for merged pull requests associated with the tag commit;
- `actions/runs/{id}/jobs` for the exact `Required CI` job result;
- `actions/runs/{id}/artifacts` and `actions/artifacts/{id}/zip` for the
  dual-runtime Release Please `verification-*` reports; and
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
Ordinary `main` push CI contains only the Node 22.15 profile, so its
otherwise successful tag-commit run is unavailable for publishing. The usual
applicable candidate is the associated Release Please pull-request run, whose
trusted same-repository profile adds the Node 24 viewer reports of the
[release profile](./ci-workflow.md#runtime-profiles).

## Identity And Completeness Proof

The release checkout supplies the tagged commit and its tree. The downloaded
artifact names
must match the CI verification namespace, be unexpired, and yield exactly one
report per viewer shard on each of `node-22.15.0` and `node-24` and one report
per browser shard on `node-22.15.0`.
All reports must name one full
commit SHA. The ordinary single-runtime profile is complete ordinary CI evidence,
but it is not release evidence and therefore classifies as absent here.

The evidence commit is applicable when it is the tagged commit or when
`git/commits/{evidence-commit}` names the tagged tree. The latter comparison is
required for pull-request CI: reports name GitHub's synthetic merge commit,
while a squash merge produces a different release commit with the same tree. A
status name, PR head SHA, or successful workflow conclusion alone never proves
release identity.

After identity is established, the aggregate validation revalidates every
runtime, suite, shard, assignment, observed result, exit outcome, and complete
inventory defined by the [CI verification contract](./ci-verification.md). In addition,
the viewer report's complete inventory must equal the Node test inventory
discovered on the tag checkout, and every browser report's spec inventory must
equal the tag checkout's `tests/browser/**/*.spec.ts` inventory. CI names the
spec that loaded each test, including a test defined in a shared helper module,
so both inventories list spec files. These comparisons prevent reports from
proving only the test files present in another tree.

## Outcomes And Failure Semantics

Evidence selection produces one of three outcomes:

- `applicable`: a candidate passes the job, artifact, identity, aggregate, and
  live Node test and Playwright inventory checks. Preparation continues with
  exact-artifact checks.
- `absent`: no candidate exists, a listing or download has a transport failure,
  the required job is unavailable, artifacts are missing or expired, the
  evidence commit cannot be resolved, or its tree differs from the tag. The
  workflow stops with one error that tells the operator to re-run CI on the
  release commit and retry the release after CI passes.
- `invalid`: an otherwise available report set is malformed, reports disagree on
  the commit, aggregate validation fails, or either live inventory differs. The
  script exits non-zero. Invalid evidence indicates a broken evidence pipeline
  and stops preparation.

An `absent` result from one candidate continues to the next ordered candidate.
If none apply, its final reason is recorded before preparation fails.
An `invalid` result stops selection immediately. Malformed required environment
is a usage error and also exits non-zero.

Artifact zip requests include the workflow token only on the GitHub API request.
The client follows GitHub's redirect to blob storage without forwarding the
`Authorization` header. Archives extract into
`.context/release-evidence/reports/<artifact>/`.

## Release Record

Every selection writes `.context/release-evidence/record.json`, which is
preserved beside the packed release artifacts. The JSON object contains:

- `mode`: `evidence`;
- `outcome`: `applicable`, `absent`, or `invalid`;
- `taggedCommit` and `taggedTree`;
- `selectedRunId` and `selectedRunUrl`, or `null` when no run was selected;
- `evidenceCommit`, or `null` when no report identity was established;
- `reportCount`; and
- `reason`, a stable human-readable explanation of the decision.

The record is diagnostic evidence. Preparation permits only an `applicable`
outcome, including when it executes evidence selection from an older tag.

## Publish Boundary And Timing

Read-only preparation owns audits, verification, package builds, and consumer
smokes. Publication requires successful preparation and rechecks its saved
archives before it uses npm publication credentials. Publication installs no
dependency lifecycle scripts and performs no build or smoke fallback.

Verification selection does not replace release-specific checks. Releases
verify immutable local and remote tags, run the live audit, download the
platform archives from the build matrix, pack and inspect the exact viewer and
CLI archives, smoke-test clean consumers, recheck source and tags, guard
existing registry versions, publish with trusted provenance in the
[publication order](./npm-release.md#release-build-matrix-and-publication-order),
and verify registry bytes and attestations.

Preparation runs only release-specific work. CI report retention is 14 days.
Missing or expired reports require a new qualifying CI run for the release
commit before preparation can succeed.
