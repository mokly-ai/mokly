# Watched Child Lifecycle Review Follow-Up

The user authorized recommendation B from
[review 7](./catalogue-inputs-and-aliases.md#review-after-bdded01): fix failed-child
cleanup with shared lifecycle state. The repeated nested-page attribution
finding remains invalid; its compiled reproduction needs no production change.

## Fix And Contract

1. **High — failed-child cleanup. Fixed, option B.** Previously, the supervisor
   cleared its handle after readiness failure or a post-ready error and sent
   only SIGTERM. A surviving child could outlive `close()` and retain its port.
   [ManagedChild](../../src/server/child_lifecycle.ts) now owns readiness,
   terminal state, and one cleanup operation per child. All failure, shutdown,
   and replacement paths retain ownership until that operation completes.
   Concurrent callers share its timers and terminal confirmation, and the first
   startup error remains the reported failure. Late ready messages are ignored.
   [Native handles](../../src/server/child_process.ts) retain terminal results
   for late subscribers, including failed process creation. Graceful-send errors
   do not bypass escalation. The
   [supervisor](../../src/server/supervisor.ts) rejects a new start while cleanup
   still owns the child and preserves resolved ports across successful restarts.
   This is broader than calling the old shutdown helper from additional catches:
   that helper could miss a prior exit and let competing callers return early.

The [watch contract](../protocol/mokly-watch.md) and README document the shared
cleanup rules. The changes preserve the 15-second readiness timeout and existing
graceful/SIGTERM/SIGKILL intervals; they add no consumer configuration.

## Mainline Integration

Before merging, the source tip was `2377b01`, main was `aa5adea`, and their merge
base was `a5ecbc0`. The audit retained main's copy/expand/collapse icons,
URL-only clipboard handling, browser and shell tests, and settled watch helpers
and tests. The icon conflict keeps all main additions plus current page wording.
Conflicting generated HTML was regenerated through the normal example build
from combined sources. No mainline feature was discarded or bulk-selected.

## Verification And Delivery

Nine deterministic lifecycle regressions were added first; eight failed on the
previous implementation. The focused lifecycle/watch suite then passed all 20
tests. A separate real-process smoke passed, verifying forced termination and safe port
reuse after a transport error while the child ignores graceful shutdown and
SIGTERM, including late terminal subscription and a successful replacement HTTP
request on the original port.

The full `cargo xtask check` passed: 606 Node tests, 106 Chromium tests, and
3 Rust tests, plus formatting, ESLint, typechecking, example freshness (70 files),
package checks, packed-consumer smokes, clippy, and the Rust file-length audit
(10 files). Browser coverage includes the integrated copy/expand controls and
watched-server shutdown. Documentation checks validated 199 local targets across
26 changed Markdown files. Logs are retained under
`.context/review-followup-5-{red,focused,process-smoke,check}.log`.

The mainline diff audit found only the three previously approved deletions;
there were no new removals. The checked fix was committed and pushed as
`453b0bd` before review 8/10. Its new finding was reported for user selection,
as required by the repository's review rule.

## IPC Disconnect Follow-Up

Fix `453b0bd` was pushed before review 8/10. That review reported one new
**Medium** finding: the native handle ignored IPC disconnection while a surviving
child silently missed reload updates. Real-process probes confirmed it on the
checked commit and pinned main `aa5adea`. Normal children already self-close on
disconnect; the gap concerns a process that remains alive. The user authorized
the recommended lifecycle fix.

Options were **A.** Observe disconnection and route it through shared cleanup,
**B.** Throw on the next disconnected send, or **C.** Keep relying on process
completion. **Recommended and applied: A.** Unlike B, it detects loss without
another authored change. The native handle retains disconnection for late
subscribers, and the lifecycle treats it as a failure while waiting or serving.
Shutdown and post-exit disconnections are ignored. Ownership remains with the
child until terminal confirmation; startup preserves any earlier diagnostic,
and recovery cannot spawn a replacement while the failed child remains alive.

Six deterministic cases and one real-process regression were added before the
fix; five failed and two controls passed. All 28 focused lifecycle/watch tests
then passed. The real-process test closes IPC from a live HTTP child that ignores
SIGTERM, verifies force-kill before same-port replacement, and proves the
replacement receives updates. Normal parent-loss shutdown and the independent
ENOENT/EPIPE spawn-failure probe also passed. The full `cargo xtask check` passed
with 613 Node, 106 Chromium and 3 Rust tests, formatting, ESLint, typechecking,
70 current example files, package checks and packed consumers, clippy, and the
Rust file-length audit (10 files). Documentation validation passed for 201 local
targets across 27 changed files. The checked fix was committed and pushed as
`8ed58a7` before review 9/10, which completed successfully and returned the three
findings assessed below. It reported no further IPC lifecycle finding.

The mainline audit captured source `453b0bd`, main `a0e349a`, and merge base
`aa5adea` before this follow-up. Main's new consumer static-export feature is
outside this focused IPC fix and remains unmerged. This patch adds no removals
to the authored branch diff. New review findings remain for user selection.

## Review After 8ed58a7

These findings concern repository publication and unmerged mainline work. The
IPC fix does not change either area. No additional production fixes were made
after review, following the user's instruction to report new findings first.

1. **High reported — dependency advisory checks missing. Integration work;
   the claimed deletion is invalid.** The audit command, xtask gate, protocol,
   and regression tests were added on main between merge base `aa5adea` and
   `a0e349a`. They were never removed by this branch's authored changes. The
   current checkout nevertheless lacks that automatic gate, and its existing
   release documentation describes a past dependency fix as audit-clean; the
   successful local checks do not establish a current advisory result.
   Leaving main's gate out during integration would lose automatic dependency
   checking. **A.** Integrate main's complete security work, including its
   lockfile, packed-consumer audit, tests, and documentation. **B.** Port an
   equivalent gate and dependency updates separately. **Recommended: A** when
   integrating main. Copying only an npm script would miss the related fixes
   and coverage. No new security result or known vulnerability is asserted here.

2. **High — output replacement can delete an unowned directory. Confirmed,
   pre-existing safety bug.** The
   [preview builder](../../scripts/preview/catalogue.mjs) checks ownership and
   confinement before capture, then `installArtifact` moves and deletes whatever
   occupies the destination later. A disposable real-server probe first built
   an owned artifact, moved it aside during capture, and put an unowned
   directory with a sentinel at the destination. Publication succeeded and
   deleted that sentinel with Changes both disabled and enabled. The same
   installer is present at merge base `aa5adea`; this is not an IPC regression.
   Doing nothing permits data loss when another process replaces the output
   during capture. **A.** Repeat ownership and confinement checks immediately
   before installation. **B.** Reuse main's shared export transaction, preserving
   its destination identity checks, writer reservation, non-replacing renames,
   and validated backup recovery, with output-swap regressions for both
   publication options. **C.** Reject every existing destination.
   **Recommended: B.** A alone leaves a check-to-rename race; C removes supported
   replacement behavior. Sharing main's transaction avoids maintaining two
   different safety boundaries. Integration must preserve v4 pages, optional
   Changes, and the branch's publication snapshot and resource contracts.

3. **Medium reported — direct preview calls accept stale generated HTML.
   Observed internal precondition, not a supported-command regression.** A
   disposable probe changed an existing screen's source without rebuilding;
   direct `buildPreview` published the old generated body. It also published a
   manually edited generated body, while `checkCompilation` rejected both.
   However, the supported `npm run preview:build` command explicitly rebuilds
   before capture. The
   [source-inventory contract](../protocol/mokly-source-protection.md#freshness-and-lifecycle)
   defines inventory freshness as path membership, with content edits applied
   by build/watch, and the publication contract snapshots existing generated
   files. The finding therefore does not establish a broken supported command
   or a violation of the current freshness contract. Bypassing the build
   precondition can still publish old content. **A.** Add a compile-and-check
   step inside the internal helper. **B.** Use main's in-memory compilation
   when integrating its shared exporter. **C.** Make the internal helper's
   build precondition explicit in its documentation and cover the npm wrapper's
   ordering. **Recommended: C for the current boundary, B during exporter
   integration.** A duplicates rendering already performed by the supported
   command. B provides the stronger public export boundary without maintaining
   a second publication engine; it must retain the accepted optional Changes
   behavior. No production freshness change is required for this IPC fix.

The post-review probes ran only in disposable fixtures and cleaned them up.
Their four successful probe cases are recorded in
`.context/review-followup-6-review-validation.log`; the review output is in
`.context/review-followup-6-postpush-review.log`. Review usage is 9/10. The
remaining mainline integration and any new fixes require the user's selection.

The user subsequently selected latest-main integration. Its combined publication
and recovery behavior is recorded in the
[mainline integration follow-up](./mainline-static-export-integration.md).
