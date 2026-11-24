# Replaced ready Changes can skip the purge switch

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from branch `calummoore/mokly-core-allocator-purge-zlcf`,
  review finding 4.
- **Location:** The call in `Source::finished` in
  `crates/mokly-cli/src/serve_changes.rs:178`, the completion after the
  publication in `crates/mokly-server/src/changes_execution.rs:63-72`, the
  sentence of `crates/mokly-cli/README.md:35` that names the trigger, the module
  and trait docs of `crates/mokly-cli/src/allocator.rs`, and the definition in
  `plans/follow-ups/purge-delay-unmeasured-platforms.md:35-41`.
- **Reason:** The race needs a cancellation in the short interval between a
  ready publication and its completion, and its worst case keeps the delay of
  `main`, so it waits under the rule for rare product bugs.

- **Terms:**
  - **Serve:** the `mokly serve` command, which hosts a catalogue and compares
    the working tree with a base commit.
  - **Changes:** the result of that comparison, which Serve publishes to its
    clients.
  - **Ready publication:** the server state update that makes a completed
    Changes result available to clients.
  - **Cancellation token:** the state that stops a comparison attempt when
    Serve replaces it or shuts down.
  - **Purge delay:** the mimalloc option `purge_delay`, the time after which a
    freed memory range becomes due for its return to the operating system.
- **Background:**
  - After Serve's first ready Changes, the core sets the default purge delay of
    its allocator, mimalloc, from 1,000 ms to 30 ms, once for each process.
    `Source::finished` makes this call through the `PurgeDelay` boundary when
    its result is `Ok`.
  - `ChangesPass` installs the ready publication and sends an update to
    clients. Then `cancel.commit` checks the cancellation token again, and it
    calls `Source::finished` only when the attempt is not cancelled.
  - A watched edit or a base branch update can cancel the attempt in the short
    interval after the publication and before that check. The ready result
    then reached clients, but `Source::finished` does not run for it. The delay
    stays at 1,000 ms until the next ready Changes that Serve completes.
  - The other completion effects of Serve also skip a replaced comparison on
    purpose, such as `resume` in `crates/mokly-graph/src/document_store.rs:99`.
    The protocol says "Superseded generations stay silent"
    (`docs/protocol/mokly-moves.md:161`).
  - The README of `mokly-cli` and the docs of `allocator.rs` say that the
    switch comes after Serve publishes its first ready Changes. In this race,
    they do not match the code.
  - The unit test `only_ready_changes_reduce_the_allocator_purge_delay` in
    `crates/mokly-cli/src/_tests_/serve_changes_tests.rs` calls
    `Source::finished` directly, so it does not cover this sequence.
  - On 2026-11-22, the performance orchestrator of the change kept the switch
    in `Source::finished`, which its performance check measured, and chose a
    follow-up item for this case.
- **Problem:** When Serve replaces a comparison right after its first ready
  publication, the switch waits for the next completed ready Changes, and the
  docs do not say so. A session that completes no later ready Changes keeps
  1,000 ms.
- **Impact if no action:** In this rare case, the core keeps the delay of
  `main` for longer, and so up to about 100 MiB more memory. The docs promise a
  switch that does not come at that point.
- **Root question:** Which event counts as Serve's first ready Changes for the
  switch, and how do the code and the docs agree on it when Serve replaces a
  comparison right after its ready publication?
- **Options:**
  - **A.** Call a dedicated ready hook in `ChangesPass` when `publish` returns
    `Ok(true)`, before `cancel.commit`. This adds a callback to the execution
    path of `mokly-server`, and a test that cancels right after a real ready
    publication. Effort: Small.
  - **B.** Notify the Changes source from the successful state swap in
    `SharedPublication` (`crates/mokly-server/src/publication.rs:213`). This
    puts the publication and its notification in one place. It adds work under
    the lock that every Changes publication takes, in a file with 294 of its
    300 allowed lines. Effort: Medium.
  - **C.** Subscribe from Serve before the comparison starts, and keep a signal
    for the first ready publication. This adds a listener and state that
    survives missed updates. Effort: Medium.
  - **D.** Keep the code. In the docs, define the trigger as the first ready
    Changes that Serve completes before a newer comparison replaces it, and say
    that a replaced ready result does not count. Edit the sentence of
    `crates/mokly-cli/README.md` that starts with "After Serve publishes its
    first ready Changes", the module and trait docs of `allocator.rs`, and the
    definition and Background of
    `plans/follow-ups/purge-delay-unmeasured-platforms.md`. Keep the rule of
    the README: state the setting, not a time. Effort: Small.
  - **E.** Keep `mokly-server` unchanged. In
    `crates/mokly-cli/src/serve_delivery.rs:148`, give `ChangesPass` a CLI
    wrapper around the shared publications. It forwards each `Publications`
    method and calls `PurgeDelay` when a ready `changes` call returns
    `Ok(true)`. A method that the wrapper misses silently uses the trait
    default. Effort: Small.
- **Left out:**
  - Running the hook after classification: Serve can still reject the result
    before its publication (`crates/mokly-server/src/changes_execution.rs:153-157`
    and line 173), and only a ready result switches the delay.
  - Running the completion for each ready publication, also after a later
    cancel: the terminal would report a comparison that Serve already replaced,
    and the staging and sidecar steps skip a replaced comparison on purpose.
- **Wider fix:** None. `install_ready` is the only ready publisher
  (`crates/mokly-server/src/changes_execution.rs:204`), so A and B are direct
  fixes for this one switch. The `documentation` skill already requires the
  docs to match the code.
- **Previous examples:** None found.
  `crates/mokly-server/src/_tests_/changes_completion_tests.rs`, added in
  `24b238ca4`, checks which results reach the completion callback after a
  publication.
- **Related:**
  - [purge-delay-unmeasured-platforms.md](./purge-delay-unmeasured-platforms.md)
    defines the first ready Changes in its Background. D edits that definition.
  - [mimalloc-v3-7-upgrade.md](./mimalloc-v3-7-upgrade.md) removes the data
    race of the run-time write that every option here keeps. The two items do
    not conflict.
- **Recommendation:** D. It adds no code and matches the measured design and
  the other completion effects of Serve. If the switch must come at the
  publication, A is a better code fix than B.
- **Action:** fix after merge, apply D, because the race needs a cancellation
  in the short interval between a ready publication and its completion, and
  its worst case keeps the 1,000 ms of `main` until the next completed ready
  Changes.
