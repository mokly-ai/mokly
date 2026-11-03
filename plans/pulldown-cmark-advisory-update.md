# Update pulldown-cmark for RUSTSEC-2026-0433

Status: Active. [PR #282](https://github.com/mokly-ai/mokly/pull/282) is open. The pull request that completes the work deletes this plan, as the `plans` skill says.

The Rust dependency audit, `npm run dependencies:check:rust`, fails in the
repository suite on `origin/main` at `f08d02df`. RustSec advisory
[RUSTSEC-2026-0433](https://rustsec.org/advisories/RUSTSEC-2026-0433.html)
says that nested image wikilinks can parse in quadratic time in
`pulldown-cmark` when `ENABLE_WIKILINKS` is set. The patched versions are
0.13.6 and newer. `Cargo.lock` selects 0.13.5, and the three manifests that
use the parser declare 0.13.4 as their floor. Mokly sets only the tables,
strikethrough, and task-list options, so it does not reach the affected
parser path. The audit checks the locked version, so it fails anyway.

User decision, 2026-11-03, given through the brief of the workspace
orchestrator: raise the existing floor to 0.13.6, so that no resolver can
keep the vulnerable release, and update only that package in `Cargo.lock`.
The alternatives were a lockfile-only update, as PR #230 did for 0.13.5,
and a reviewed audit exception. A raised floor stops a later lock change
from selecting a vulnerable release again. An exception keeps a risk that a
patched release removes. The change adds no dependency, audit exception,
test, or gate change, and it skips no test.

Design calls:

- My call, 2026-11-03: raise the floor in all three manifests that declare
  `pulldown-cmark`, in `mokly-catalogue`, `mokly-graph`, and `mokly-html`.
  The brief named `mokly-html` only. Each manifest declares the same floor,
  and one raised floor alone leaves two manifests that accept a vulnerable
  release.
- My call, 2026-11-03: commit the dependency change before this plan, in
  its own commit. Two parent workspaces integrate that exact commit. A plan
  file in it, or in a commit before it, would reach their branches and
  could land on `main` after this plan is deleted.
- My call, 2026-11-03: add no test. The existing Markdown tests of the three
  crates cover the rendering behaviour. A regression or performance test of
  the third-party parser is a one-time proof of a third-party tool, which
  the `testing` skill gives no test.

Contract owners:

- [Dependency security](../docs/protocol/dependency-security.md#rust-advisory-audit).
  Its update policy explains a one-time update in its pull request, so the
  page does not change.
- [Markdown documents](../docs/protocol/mokly-documents.md#rendering). The
  rendering options do not change.
- The [mokly-html README](../crates/mokly-html/README.md).

## Milestone 1: Dependency update

Depends on: none

Raise the `pulldown-cmark` floor to 0.13.6 and lock 0.13.6. The
`non-ui implementor` makes the change. The orchestrator checks it and
commits it as the checkpoint for the two parent workspaces.

- [x] Capture the failing audit on the unchanged tree. Evidence:
      `.context/rust-audit-0433/audit-before.log`.
- [x] Raise the floor in the three manifests, and update only the
      `pulldown-cmark` entry of `Cargo.lock`.
- [x] Run the Rust audit and the targeted checks. Evidence:
      `.context/rust-audit-0433/checks.md`.
- [x] Commit and push the dependency change as the checkpoint commit
      `9447445d`.
- [x] Send the checkpoint commit and the pull request to the sessions of
      workspaces 461 and 463.

## Milestone 2: Verification, review, and pull request

Depends on: 1

Prove the change with the complete gate, review it, and make the pull
request ready for the user to merge. A lockfile change waits for the user's
merge.

- [ ] Run the complete gate, `cargo xtask check`.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Send each later source fix commit to the sessions of workspaces 461
      and 463.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Update the title and the description of the pull request, mark it
      ready, and watch its CI. The description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
