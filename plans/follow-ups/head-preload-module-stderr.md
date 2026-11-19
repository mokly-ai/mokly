# Decide on repeated module stderr from the head preload

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-19, from the options check of the head preload design on
  branch `calummoore/mokly-generation-prefetch`.
- **Location:** `crates/mokly-sidecar/src/pool_preload.rs` (the preload
  `describe`), `crates/mokly-sidecar/src/process_io.rs` (`forward_piece`), and
  `docs/protocol/mokly-sidecar-head-preload.md`.
- **Reason:** Each option changes a requirement: the rule that the preload
  changes no output, or the rules of the preload or of forwarded stderr, and
  the performance orchestrator owns that choice.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Head preload:** Serve background work that loads a newly described head
    generation into the other idle head processes before its renders. It
    sends `restoreGeneration`, `cssModules`, and `describe`.
  - **Evaluation:** the `describe` request runs the consumer's catalogue
    modules in the sidecar process. The `bundle` and `restoreGeneration`
    requests evaluate nothing.
  - **Forwarded stderr:** each sidecar process sends its standard error to the
    Serve terminal as diagnostic lines, without a change.
- **Background:**
  - On 2026-11-18 the performance orchestrator chose the head preload, under
    the user's delegation of 2026-11-16 to keep optimising Serve speed without
    asking. One of its rules says that the preload changes no output.
  - Without the preload, each process that renders a generation evaluates it
    once, when its first render needs it. With the preload, every idle head
    process that was live at the `describe` evaluates it, also a process that
    no render of a small edit reaches.
  - Consumer code that writes to stderr at module level, for example a
    top-level `console.log`, writes once in each process that evaluates the
    generation. The sidecar redirects `console` and `stdout` writes to stderr.
  - After a large edit, every process renders, so the preload changes only
    the time of these lines. After a small edit, the preload adds up to one
    copy for each head process that no render reaches.
  - Nobody reproduced this. The code shows it: the preload `describe` is an
    ordinary request, and `forward_piece` forwards all process stderr.
- **Problem:** After a small edit, consumer code that writes to stderr at
  module level can print extra copies of its lines in the Serve terminal.
- **Impact if no action:** A user whose catalogue modules write at load time
  sees one to three more copies of those lines after some edits. No result
  changes.
- **Root question:** Which terminal output may the head preload add, if any?
- **Options:**
  - **A.** Accept the copies. Add one sentence to the head preload page: the
    stderr of a preload evaluation reaches the terminal as for any other
    evaluation. Effort: Small.
  - **B.** Preload only `restoreGeneration` and `cssModules`, so that no
    consumer code runs in the background. The first render of each process
    still evaluates the generation, so part of the 110 ms to 250 ms of each
    process stays on the critical path. Effort: Small.
  - **C.** Drop the stderr of a process while a preload `describe` runs. Stderr
    is a process stream, not a part of a reply, so this also drops real
    diagnostics, such as a crash report of that evaluation. Effort: Medium.
- **Left out:** A preload that reaches only the processes that the renders of
  the edit will use, because the core knows the changed views only after
  `graph.prepare`, at the end of the time that the preload uses.
- **Wider fix:** None. Evaluation output is consumer behaviour, and forwarded
  stderr already treats every evaluation alike.
- **Previous examples:** None found.
- **Related:** [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
  also weighs which processes load a generation.
- **Recommendation:** A. The copies repeat lines that the user already sees
  from the process that bundled the generation, and every process that renders
  prints them today.
- **Action:** ask the user, because A changes the rule of the performance
  orchestrator of 2026-11-18 that the preload changes no output, and B and C
  change other rules.
