# Publish Catalogue

Status: Completed. [PR #71](https://github.com/mokly-ai/mokly/pull/71)
merged on 2026-09-14. [Delta Publishing](./delta-publishing.md) later
replaced its single-archive upload exchange.

Implement the public [upload v1 contract](../docs/protocol/mokly-upload.md) in
the npm CLI and a composite GitHub Action. Receivers use documented artifacts
only; no private Cloud integration or hosting service is part of this change.

## Milestone 1: Protocol and integration documentation — completed

Define the complete receiver and consumer contract before implementation.

- [x] Draft and share upload v1: manifest, archive, HTTP, limits, errors and Git metadata.
- [x] Align export protocol, README and action usage with publish and current-only behavior.
- [x] Add this plan to the active index.

## Milestone 2: Export, upload bundle and CLI — completed

Keep the shared exporter functioning while adding a separately authorized upload.

- [x] Add failing tests for CLI options, metadata, bundles, limits, HTTP failures and token secrecy.
- [x] Add current-only export through the existing transactional engine; preserve comparisons by default.
- [x] Build the owned manifest and bounded tarball from finalized export bytes.
- [x] POST through an injectable HTTP boundary with typed failures and cancellation.
- [x] Verify installed-package operation, repeated exports and pinned comparisons with integration tests.
- [x] Align required receiver files with the export's public inventory; retain exclusion of the source catalogue manifest.

## Milestone 3: Public composite action — completed

Install an explicitly pinned npm release and run the supported CLI.

- [x] Add failing action tests for package pinning, argument forwarding and hostile input quoting.
- [x] Implement the action under `.github/actions/publish` and document consumer setup.
- [x] Smoke-test action execution and the packed CLI against a local HTTP receiver.

## Milestone 4: Verification and delivery — completed

Complete branch work before review; merge remains the plan completion boundary.

- [x] Run relevant tests, package build and smoke tests; validate Markdown and full diff.
- [x] Update release-package fixtures to include publish code and the distributed receiver protocol, retaining release integrity checks.
- [x] Capture raw temporary-storage setup failures in a failing CLI test, then add a typed publish fallback without exposing raw exceptions.
- [x] Run `cargo xtask check` and resolve any failures.
- [x] After checks pass, `git add -A`, commit all work with Conventional Commits and push the branch.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md) to review the complete local diff against `origin/main`; report numbered, severity-rated findings with options/recommendations without changing the implementation.

Implementation commit `e7d46d7` was pushed before the read-only review against
`origin/main` (`5b4c647`). The [review report](../docs/reviews/publish-catalogue.md)
records two P2 findings. The user approved fixing both after validation; the
follow-up milestones below track that work. This plan stays active until merge.

## Milestone 5: Review follow-up protocol — completed

Define the ownership file boundary and unambiguous CLI value syntax first.

- [x] Document ownership v1 fields, reader policy, inventory semantics and public fixture format; link it from upload/export and the README.
- [x] Document `--name=value` for value options, including leading-dash credentials, empty values and boolean rejection.

## Milestone 6: Review regressions and fixes — completed

Protect the public artifact and argument boundaries with focused regressions.

- [x] Capture failing tests for assigned option values and token secrecy before changing the parser.
- [x] Capture missing public fixture/package coverage, then add ownership conformance fixtures and check them against the exporter and an independent packed-consumer reader.
- [x] Implement shared assigned-value parsing and verify command-option restrictions remain enforced.
- [x] Exercise the installed CLI with a leading-dash token and compare complete uploaded inventories with the documented ownership shape.
- [x] Update relevant READMEs and record the approved findings as addressed.

## Milestone 7: Follow-up verification and delivery — completed

Deliver the approved fixes and review the complete branch after the push.

- [x] Run focused tests, package/upload smoke tests, Markdown validation and `cargo xtask check`; resolve failures.
- [x] After checks pass, `git add -A`, commit with Conventional Commits and push the branch.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md) against `origin/main`; report findings without automatically changing the implementation.

Follow-up commit `5f84921` was pushed before the complete branch review against
`origin/main` (`5b4c647`). Both approved findings are addressed; the final review
found no additional actionable findings. All branch milestones are complete.

## Post-merge follow-up (non-blocking)

Release the npm version containing publish before consumers invoke the action.
Consumers then pin that exact version and an action commit/tag. A separate
`mokly-ai/publish-action` repository can reuse this composite action later.
Close this plan in the index when its PR merges.

## Verification evidence

`cargo xtask check` passed on Node 22.14.0: 1,074 unit/integration tests, 247
browser tests, packed consumers and their dependency audit, example/package
checks, formatting, lint, types, Rust formatting/Clippy, three Rust tests and
the Rust file-length audit. The 30 focused publish tests also passed on Node
24.14.1. The action's actual shell steps were exercised with an injected npm
installer; real packed CLI uploads were accepted and extracted by a local
HTTP receiver in both comparison modes, with exact exported-byte checks.

Earlier runs caught release fixture inventories needing the new package files,
a raw temporary-storage preparation error (covered before fixing), one native
Node 24 loader crash, and an intermittent existing watched-comparison browser
test. The last two passed when rerun independently; the complete final Node 22
gate passed without retries or skipped tests.

The approved review follow-up also passed `cargo xtask check` on Node 22.14.0:
1,084 unit/integration tests, 247 browser tests, three Rust tests and every
formatting, lint, types, dependency, package, example and Rust gate. No test
failed, was retried, skipped or cancelled. Before that gate, nine new regressions
failed, then all 41 focused tests and the packed-consumer smoke passed with the
fixes. The installed package includes the ownership contract and all 27 fixture
cases; actual uploads use assigned leading-dash credentials in both modes.
