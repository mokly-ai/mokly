# Recover from native watch event loss

- **Severity:** Medium. **Likelihood:** Rare (estimate). **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 134, from the Milestone 11 plan TODO.
- **Location:** `crates/mokly-watch/src/native_events.rs:33-42`,
  `crates/mokly-watch/src/native.rs:140`,
  `docs/protocol/mokly-watch.md:152-154`, and the native CI matrix at
  `.github/workflows/ci.yml:220-227`.
- **Reason:** The plan waited for the first hosted macOS and Windows runs,
  and on 2026-10-21 the user deferred the open review items until after the
  merge.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Native watcher:** the operating system's file change service that the
    watch crate uses: FSEvents on macOS and directory change notifications
    on Windows.
  - **Rescan flag:** a flag on a native event that says the watcher lost
    detail and the directory must be scanned again.
- **Background:**
  - Serve watches the catalogue inputs and rebuilds after a change.
  - `docs/protocol/mokly-watch.md:152-154` says that a rescan flag or a
    pathless native event queues a repository-root change and reports one
    loss warning per observer. `native_events.rs:33-42` does this, and
    `native.rs:140` rescans the registrations.
  - The plan recorded that native watchers can drop events: macOS FSEvents
    batches events, and Windows buffers can overflow. It asked for a
    recovery rule after the first hosted macOS and Windows runs, with tests.
  - At that time the hosted native jobs did not pass, so no measurement
    exists. The CI native job now runs on hosted macOS and Windows runners,
    at `ci.yml:220-227`.
  - This item replaced an earlier TODO of the rebuild's watch milestone,
    which held the same choice. That TODO read "After the first hosted macOS
    and Windows runs, make event loss recoverable there".
- **Problem:** Mokly has no tested recovery rule for events that macOS
  batching or a Windows buffer overflow loses on those platforms.
- **Impact if no action:** Serve can stay on stale output after a lost
  event, until the next change or a restart.
- **Root question:** How does Serve stay correct when the native watcher
  loses events on macOS or Windows?
- **Options:**
  - **A.** Rescan the repository roots after each macOS batch, and check
    exact-input stamps on Windows. Effort: Medium (estimate).
  - **B.** Use one recursive watch for each root on both systems. Effort:
    Medium (estimate).
- **Left out:**
  - A periodic rescan on a wall clock. It adds timing behaviour and delays
    recovery.
  - Former option C: Keep the current rescan-flag recovery. Add hosted
    macOS and Windows tests that force a batch and a buffer overflow. Add A
    or B only for a loss that comes without a rescan flag. Effort: Small
    (estimate). Under the `testing` skill of 2026-10-30, the hosted check of
    the operating system's watcher is a one-time proof. Run it once, and
    save its output under `.context/`.
  - Fewer than three approaches remain, because former option C now holds
    only that one-time check.
- **Wider fix:** A. Platform-specific recovery handles each known loss mode
  and keeps the current watcher ownership.
- **Previous examples:** None found.
- **Related:** [watch-resource-attach-gap.md](watch-resource-attach-gap.md)
  is another case where Serve can miss a change. Both concern how Serve
  recovers watched changes, so one branch can test both.
- **Recommendation:** A (estimate). It handles each platform's known loss
  mode directly.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6078).
