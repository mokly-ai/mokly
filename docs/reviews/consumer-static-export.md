# Consumer Static Export: Post-Push Review

Reviewed on 2026-09-09 with `cargo xtask review`, after implementation commit
`638b848` and checklist commit `d8c7a13` were pushed to
`calummoore/publish-export`. The read-only review covered the complete committed
diff from `origin/main` (`e47524b`) to `d8c7a13` and exited successfully.

The user subsequently approved fixes for all four findings and integration of
latest main. Remediation passed full verification in
[Milestone 7](../../plans/consumer-static-export.md). The findings below preserve
the original review context; they were not automatically fixed during review.

## 1. Medium: Case Aliases Can Bypass Export Serialization

The reservation in [transaction.ts](../../src/export/transaction.ts) hashes a
projected real path. Missing output names such as `site` and `Site` produce
different keys even when the filesystem treats them as one destination.
Concurrent exports could both acquire reservations and replace or roll back over
each other's output, violating the one-writer contract.

Options:

- A. Reject output names that differ in case from existing siblings. This alone
  does not cover two simultaneous writers to a previously missing output.
- B. Share a filesystem-aware output identity across locking and ownership,
  covering case aliases, symlink aliases, and ancestor spellings. Add concurrent
  same-path/case-alias/symlink-alias tests on supported filesystem behaviors.
- C. Serialize every export beneath a parent directory, at the cost of blocking
  otherwise independent output destinations.

Recommended: B. A basename-only patch can miss ancestor aliases; a shared identity
and concurrency tests protect the whole transaction boundary.

Verification: read-only calls produced different reservation keys for two
case-variant missing names. Case-variant spellings of the existing workspace
resolved to the same device/inode on this machine. No concurrent destructive
replacement was attempted.

## 2. Medium: Nested Package Roots Can Enter Public Output

[public_files.ts](../../src/export/public_files.ts) excludes configured source
trees and specific config modules, but not `moduleResolution.packageRoots`.
A valid package root inside `mockupsDir` can therefore contribute `package.json`
and other non-source package files to hosted `static/...` output, contrary to the
export contract's npm-package exclusion.

Options:

- A. Exclude only each package root's `package.json`; other package payloads could
  still be published.
- B. Introduce a shared export resource policy that excludes nested package
  payloads, defines the equal-root case explicitly, and preserves valid ancestor
  roots such as `packageRoots: ["."]`. Cover current and baseline resource paths
  with inside/equal/ancestor boundary tests.
- C. Reject export configurations with package roots inside `mockupsDir`.

Recommended: B. Centralizing the package boundary prevents current and comparison
resource paths from diverging; a filename-only exclusion is too narrow.

Verification: code inspection confirmed that config validation permits nested
package roots and neither public capture nor its shared minimum file check
excludes those roots. No private consumer files were copied during verification.

## 3. Medium: Watch Can Suppress Unowned Descendants

[ignored.ts](../../src/export/ignored.ts) ignores every descendant of a directory
with a valid export marker, without consulting its inventory. The predicate also
prunes directories in the real watcher. An added, unowned `site/notes.md` can be
missed by a broad consumer watch rule even though replacement correctly rejects
that mixed directory. Consumers can miss an expected rebuild or reload.

Options:

- A. Declare whole marked directories ignored, including unowned additions, and
  explicitly narrow the documented watch guarantee.
- B. Make pruning inventory-aware while retaining traversal needed to discover
  unowned descendants; continue ignoring owned files and active transactions.
  Add real-watcher tests for mixed directories as well as classifier tests.
- C. Retain coarse pruning and separately scan for unexpected descendants.

Recommended: B. Changing only the leaf classifier is insufficient if the parent
is still pruned. Watcher-level coverage prevents the same missed-event class.

Verification: a read-only classifier call ignored an unlisted path under the
existing owned preview. The same predicate is passed to Chokidar's directory
pruning option. No user file was added to the artifact.

## 4. Low: Exported Fragment Links Are Not Fully Validated

[references.ts](../../src/export/references.ts) verifies referenced files but
discards URL fragments. Generated build outputs have anchor validation, while
exported shell pages and additional public HTML do not receive equivalent
coverage. A successful export can contain an in-page or cross-document link that
does not reach its intended section.

Options:

- A. Add a separate fragment-anchor check to the exporter.
- B. Extract shared target/anchor validation from the build validator and adapt
  its resolution to static aliases and exported files, with regression tests.
- C. Document fragment validation as build-only and accept broken public links.

Recommended: B. Sharing the validation logic avoids two implementations drifting
while preserving the distinct build and static URL-resolution policies.

Verification: an in-memory export inventory containing `other.html#missing`
passed validation when `other.html` contained no matching anchor.

## Initial Review Validation And Limits

Before commit and push, `cargo xtask check` passed all 429 unit/integration tests,
86 browser tests, packed-consumer and package/license checks, formatting, lint,
typechecking, committed example verification, Rust formatting/Clippy, three Rust
tests, and the Rust file-length audit. The independent reviewer did not rerun
tests because its process was read-only. Those original tests did not cover the
four gaps above; the approved remediation below adds targeted regressions.

Empty registries retain existing Build/Check/Serve validation rather than gaining
new support. No npm release or hosting deployment was performed.

## Approved Remediation

All four findings were reproduced with failing tests before fixes. The follow-up
implements the recommended preventive scope:

1. Native per-output lock directories now share the filesystem's case and Unicode
   identity, including ancestor and symlink aliases. Distinct destinations remain
   concurrent. Owned namespace metadata persists; legacy locks require explicit
   recovery and unowned/symlinked namespaces are never adopted.
2. One resource policy excludes nested package payloads from both current files
   and baseline snapshots, rejects an equal package/public root, and preserves
   valid ancestor package roots. Integration coverage uses real Git snapshots.
3. Watcher traversal and event classification use the export inventory without
   pruning directories needed to discover unowned additions. A real Chokidar
   regression verifies later unowned files emit events while owned files do not.
4. Build and Export share HTML reference parsing and decoded-anchor validation.
   Tests cover self/query/cross-document links, hosting aliases, encoded anchors,
   directory indexes, and the existing resource-only snapshot policy.

The 12 added regression tests and both preview comparison integration tests
passed before integration. Main was fetched and audited from captured source tip
`1b723f3ce57657f4f1ee2d6e526e0ad55f6deaee`, then merged from
`93ac77848993bf1757eceac9387aef485823acf2`. The plan-index conflict retained both
plans. Main's design sources, generated screens, and new tests match main exactly;
the combined diff deletes no files from main.

Merged verification: `MOKLY_PLAYWRIGHT_PORT=54861 cargo xtask check` passed
all 465 unit/integration tests, 104 browser tests, packed consumers, package and
license checks, generated example verification, formatting, lint, typechecking,
Rust formatting/Clippy, three Rust tests, and the file-length audit. Another
workspace occupied the default browser port, so the final full run used a
verified free port without disturbing that server. Two existing CLI startup
tests timed out under an earlier parallel load; both passed in isolation and in
two subsequent full suites without changing their timeouts or test concurrency.

Delivery: merge/fix commit `fd543db5a59b8889807f0818b710e769a42786ba` was pushed
before `cargo xtask review`. Five additional browser smoke tests passed after
the commit changed the merge baseline to `93ac778`; mobile and desktop exported
screens were also visually checked. The second read-only review completed
successfully on 2026-09-09. It reported the following two new findings, which
were not automatically fixed. Final plan/index/report edits are documentation-only.

## Follow-Up Review: New Findings

The user subsequently approved both findings. Milestone 8 implements the
transaction safeguards and shared cleanup-error policy; the original findings
remain below as historical context. These were not fixed automatically by review.

### 1. High: A Destination Race Can Delete Unowned Files

In [transaction.ts](../../src/export/transaction.ts), `install()` checks output
ownership before separately moving the destination to `backup/`, installing the
stage, and deleting the backup. The reservation excludes other Mokly writers,
but an unrelated editor or process can introduce unowned destination contents
after validation and before that move. Those contents can reach the backup and
then be recursively deleted. Doing nothing retains a potential user-data-loss
path despite the documented refusal to replace unowned output.

Options:

- A. Require consumers to keep all other writers away from output while exporting.
  This narrows the guarantee and relies on consumer coordination.
- B. Revalidate the captured backup after the move and preserve unexpected
  contents. Restore only when safe, otherwise retain a clearly identified
  recovery directory. Add injected-operation regressions for late unowned
  additions, mixed backups, and concurrent destination replacements.
- C. Broaden the parent-directory lock. This can coordinate more cooperative
  writers but cannot exclude unrelated editors or processes by itself.

Recommended: B. Keep validation, safe restoration, and deletion eligibility
together at the transaction boundary instead of adding an isolated check at one
call site. This costs additional state/error handling but protects the whole
destructive-cleanup path. Document the residual limits of non-cooperating writers;
a parent lock alone does not remove that risk.

Verification: code inspection confirms there is no backup ownership check
between the move and removal. No user files were changed to reproduce the race.

### 2. Medium: Cleanup Can Hide The Original Export Failure

[run.ts](../../src/export/run.ts) awaits `transaction.close()` in `finally`.
When installation already failed with a rollback or backup-cleanup error,
`close()` can throw its retained-backup error and replace the original exception.
Existing transaction-level tests assert each error separately, not propagation
through `exportCatalogue()` and the CLI. Doing nothing can hide the original
failure and make recovery instructions less actionable.

Options:

- A. Keep only the retained-path diagnostic and accept the lost primary cause.
- B. Preserve the original failure while aggregating cleanup diagnostics and
  recovery paths; add export-orchestrator and CLI-boundary regression coverage.
- C. Suppress `close()` failures, losing cleanup information instead.

Recommended: B. Use one consistent error-composition policy at the orchestration
boundary, including non-install failures, and test what the CLI actually reports.
This is broader than catching one `finally` exception, but prevents failure
masking across cancellation, rollback, install, and cleanup paths.

Verification: JavaScript `finally` semantics and the existing retained-backup
branches confirm the masking path. The independent reviewer did not rerun tests;
the implementation gate and post-merge smoke results above were run separately.

## Approved Transaction Follow-Up

Both findings and related recovery gaps were reproduced before fixes. Captured
backups are revalidated before installation and deletion. Backup cleanup unlinks
only validated files and removes directories non-recursively; final reservation
cleanup also preserves late recovery entries and dangling links. Restoration
leaves observed recreated destinations untouched and retains unsafe backups.

One cleanup policy retains primary and secondary failures, ordered cause objects,
and visible CLI diagnostics through partial setup, cancellation, rollback, and
post-install cleanup. Twenty new tests cover these boundaries, including four
real subprocess CLI failure cases. All 59 focused export/static-delivery tests
passed. `MOKLY_PLAYWRIGHT_PORT=54861 cargo xtask check` passed all 485
unit/integration tests, 104 browser tests, packed consumers, package/license
checks, example verification, formatting, lint, typechecking, Rust formatting
and Clippy, three Rust tests, and the Rust file-length audit.

Delivery: implementation commit `7fee0f49ad20983cb5dcd26540b864a2d635ba86` was
pushed before `cargo xtask review`. The third read-only review completed
successfully on 2026-09-09 against `origin/main` (`93ac778`), covering 91 changed
files. It reported the new finding below, not an unresolved instance of either
approved transaction finding. The reviewer did not rerun artifact-writing checks;
the complete implementation gate above was run separately. Mainline preservation
audits found no deleted files, and main's example design sources/generated files
remain unchanged. Final plan/index/report edits are documentation-only.

## Transaction Follow-Up Review: New Finding

### 1. Medium: Adapter Aliases Bypass Collision Validation

The export engine accepts adapter aliases in [run.ts](../../src/export/run.ts).
[references.ts](../../src/export/references.ts) checks path safety, an exact
alias/file match, and target existence, but does not apply the case-folded exact
and prefix collision rules in [inventory.ts](../../src/export/inventory.ts).
The repository's [preview adapter](../../scripts/preview/catalogue.mjs) creates
extensionless aliases for `view/*.html` and `static/*.html`.

Doing nothing allows an export to pass validation with an alias such as
`view/foo` for `view/foo.html` while `view/foo/bar.html` also creates a real
directory at that URL prefix. Clean-URL hosts can interpret those routes
ambiguously or serve unintended content. Alias/alias and case-folded alias/file
collisions also escape the documented
[single collision-checked inventory](../protocol/mokly-export-delivery.md).

Options:

- A. Add separate alias/file and alias/alias collision checks in reference
  validation. This repairs the immediate gap but duplicates path policy.
- B. Extract or reuse one collision index for deployed files and adapter aliases,
  with regression tests for alias/file, alias/directory, alias/alias, and
  case-folded collisions, plus preview-adapter integration coverage.
- C. Narrow the protocol so adapters alone own alias safety, weakening the
  engine's documented guarantee.

Recommended: B. A shared namespace prevents collision rules from drifting across
file assembly and host adapters. It requires a modest abstraction change, but
provides broader protection than another local validation loop.

Verification: read-only, in-memory calls to the built modules accepted an
alias/directory prefix collision, a case-folded alias/file collision, and an
alias/alias prefix collision. Adding those aliases to the existing file inventory
rejected all three cases. No export or filesystem mutation was used for this
reproduction. It was left unchanged at review handoff; the user subsequently
approved the shared-index fix, latest-main integration, and PR delivery in
[Milestone 9](../../plans/consumer-static-export.md). The
[integration record](./consumer-export-integration.md) tracks final verification
and post-push review for that delivery.
