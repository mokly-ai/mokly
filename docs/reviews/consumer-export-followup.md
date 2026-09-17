# Consumer Export: Approved Follow-Up Verification

Historical handoff: the user subsequently approved both findings below. Their
implementation and verification are tracked in the
[exclusive-destination follow-up](./consumer-export-exclusive.md).

## Delivery

The user approved the two code recommendations from the
[integration review](./consumer-export-integration.md) and investigation of its
Node 22 CI failure. Those changes are committed and pushed as
`38e0aaae796e750c4a2f96124c9e468e5774c543` on PR
[#49](https://github.com/mokly-ai/mokly/pull/49), targeting `main`.
Main remains `a5ecbc06d6169ec4af5329d52b6f13b2cd2f0276`, already merged into the
branch. Before/after-commit audits found no mainline file deletions.

Implemented follow-ups:

- Whole-artifact deployment identity, authenticated shell metadata, and full
  reload across deployments with unchanged comparison generations.
- Shared lexical/real-path adapter confinement, checked before staging and
  installation, with safe scratch-root symlinks retained.
- Semantic-state watcher test observation, with the same deadlines and all
  recovery/comparison assertions retained. A controlled Node 22/Linux
  removal/repair interleaving reproduced the earlier assertion before the fix.

Local Node 24.2.0 `cargo xtask check` passed all 578 unit/integration tests,
105 browser tests, 3 Rust tests, formatting, lint, typechecking, current examples,
package/license checks, packed ESM/NodeNext/npx/Accounting/Juno consumers, and
the Rust file-length audit. Clean Linux Node 22.14.0/npm 11.7.0 also passed all
578 unit/integration tests. Mobile and desktop owning screens were inspected.

[GitHub CI](https://github.com/mokly-ai/mokly/actions/runs/34394071462) passed
the complete gate on both Node 22.14 and Node 24: each ran all 578
unit/integration tests, 105 browser tests, and 3 Rust tests, with no failures,
cancellations, or skipped tests. Required CI and the
[PR preview](https://github.com/mokly-ai/mokly/actions/runs/34394071420) passed.

The required post-push `cargo xtask review` completed successfully on 2026-09-09
against `origin/main`, reporting the two new findings below. The reviewer
inspected the committed diff read-only and did not run tests; the local and CI
results above are separate verification. Both findings were independently
checked. They are recommendations awaiting user approval, not implemented fixes
or new plan milestones. No PR merge or npm release was performed.

## New Review Findings

### 1. High — Installation adopts a destination created after reservation

Status: confirmed; Group: filesystem transactions; awaiting user decision.

`ExportTransaction.open()` in [transaction.ts](../../src/export/transaction.ts)
validates output but does not retain its initial presence or identity.
`install()` accepts the current state, and
[ownership.ts](../../src/export/ownership.ts) permits an empty or valid
marker-owned directory. Stage installation uses ordinary replacing rename.
The reservation coordinates Mokly writers, not unrelated filesystem edits.

Three isolated diagnostic probes confirmed that an initially absent output is
replaced when it appears as an empty directory or a copied marker-owned export
before installation, and when an empty directory appears immediately before
the stage rename. The destination inode changed and the staged content replaced
the late content. No production code or committed tests were changed for this
new finding.

Impact of doing nothing: a concurrent destination can be adopted and discarded
without being the output originally inspected. A late copied export can lose
its contents. Existing unowned-file and backup-recovery checks do not close
this install-phase race; passing tests and CI therefore do not remove this risk.

Options: A) retain a typed initial destination snapshot, reject unexpected
transitions, and introduce non-replacing installation semantics at the shared
filesystem boundary; B) add an existence check only; C) weaken the documented
replacement guarantee. Recommended: A, before merging. Cover initial absence,
late empty/marker-owned outputs, existing-output identity changes, and the
check-to-rename interval with deterministic regressions on supported platforms.
This is broader than B, but a check alone still races with replacing rename.
Keep the [recovery contract](../protocol/mokly-export-recovery.md) explicit
about both installation and restoration, rather than adding another isolated
preflight check.

### 2. Low — Release bootstrap guidance is presented as current procedure

Status: confirmed pre-existing documentation drift; Group: release docs;
awaiting user decision.

[npm-release.md](../protocol/npm-release.md) still describes an initial
`0.0.0` package and first-publication steps, while `package.json` and the
release-please manifest are at `0.6.0`. Both sides of this mismatch are already
on `origin/main`; the export branch did not introduce it. README still points
maintainers at those bootstrap instructions.

Impact of doing nothing: maintainers can mistake completed bootstrap work for
active release procedure and misunderstand the release-managed version state.
Options: A) document the current release-please workflow without a hardcoded
current version and retain bootstrap steps as clearly completed history;
B) add a historical label only. Recommended: A. It removes the stale
version/procedure coupling instead of requiring another documentation edit on
every release. Preserve historical context and do not revert package versions.

## Handoff

The approved implementation and CI repair are complete; plan milestones 1–13
remain completed. CI is green, but finding 1 should be addressed before merging.
The new findings do not authorize an automatic fix/review cycle.
