# Editor files make restarts miss the head entry

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the performance orchestrator's call on the
  exact Serve plan change, on branch
  `calummoore/mokly-plan-reuse-editor-files-6dni`. The call asked for this
  item for the restart misses that the change leaves.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:150` to line 157,
  `packages/mokly/src/sidecar/resolution-inputs.ts:76` to line 84,
  `packages/mokly/src/sidecar/physical-input-reader.ts:219` to line 237,
  `crates/mokly-render/src/bundle_attempt.rs:112` to line 124,
  `crates/mokly-render/src/input_stamp.rs:109` to line 123,
  `crates/mokly-render/src/bundle.rs:62`, and the section "Reuse And Identity"
  of `docs/protocol/mokly-sidecar-recipes.md`.
- **Reason:** On 2026-11-18 the performance orchestrator limited candidate
  names to the plan check of a Serve edit, and it left compiled and stored
  reuse for a separate, later decision. The exact Serve plan change does not
  wait for that decision.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Editor files:** files that an editor keeps beside a source file, such
    as the Vim swap file `.action.tsx.swp` and the backup file `action.tsx~`.
    In the measured case, no import of the captured compilation can select
    these two names. This is a fact of that compilation, not a rule for all
    editor file names.
  - **Head entry:** the bundle cache entry of the head side of Serve. The
    section "Bundle Entries" of `docs/protocol/mokly-base-cache.md` defines
    the bundle cache, which keeps compiled bundles for later processes.
  - **Candidate names:** the names that esbuild 0.28.2 can look up in a
    recorded directory during a compile. The section "Candidate Names" of
    `docs/protocol/mokly-sidecar-plans.md` defines them.
  - **Consumed-directory checks:** the checks of the file and link names of
    each directory that holds a consumed module or a lookup root. They use
    the `inputDirectories` and `metadataDirectories` lists of a compilation,
    and the `InputStamp` memberships that the core builds from them.
  - **Plan check:** the check of a plan record that the core of a Serve head
    runs before each Serve edit request.
- **Background:**
  - A restart of Serve tries to reuse the head entry. The pool restores the
    stored compilation with `restoreGeneration`. Then `reuse()` in
    `packages/mokly/src/sidecar/compiled.ts` checks it. Line 150 to line 155
    compare the `inputDirectories` lists, and line 156 to line 157 check the
    captured reuse evidence. A difference makes the head compile with
    capture. The new compilation then replaces the head entry.
  - Three kinds of check compare whole directories:
    - The reuse evidence keeps every entry of each recorded directory, as
      the section "Reuse And Identity" of
      `docs/protocol/mokly-sidecar-recipes.md` requires. `current` in
      `packages/mokly/src/sidecar/physical-input-reader.ts` compares whole
      directories at line 219 to line 237. The Rust check
      `physical_inputs::current` in `crates/mokly-render/src/physical_inputs.rs`
      does the same.
    - `resolutionInputs` at
      `packages/mokly/src/sidecar/resolution-inputs.ts:76` to line 84
      records the file and link names of each consumed-module directory and
      each lookup directory. It writes them as `inputDirectories` and
      `metadataDirectories`. The section "Reuse And Identity" of
      `docs/protocol/mokly-sidecar-recipes.md` requires this check. Added or
      removed files in a consumed-module directory invalidate reuse, so a
      higher-priority module cannot remain hidden.
    - `stamp` at `crates/mokly-render/src/bundle_attempt.rs:112` to line
      124 turns `metadataDirectories` into `InputStamp` memberships. The core
      reuses a retained state only while `InputStamp::matches` at
      `crates/mokly-render/src/input_stamp.rs:109` to line 123 lists the same
      names. The check is at `crates/mokly-render/src/bundle.rs:62`.
  - The measured editor case ran on 2026-11-18. It used the release binary
    of `main` at `be242a628` with its matching sidecar dist, on a copy of
    `examples/basic`:
    - The setup added `.action.tsx.swp` and `action.tsx~` beside
      `examples/basic/src/components/action/action.tsx`, after the first
      captured compile.
    - Exactly one observation of the captured reuse evidence changed: the
      listing of `examples/basic/src/components/action`. The
      `inputDirectories` list of that directory changed too, and its
      `metadataDirectories` list changed with it. No other recorded input,
      kind, digest, or link target changed.
    - That directory holds the consumed module `action.tsx`. So it is both a
      consumed-module directory and a recorded directory.
    - All nine measured edits fell back to two esbuild compiles and one
      classification. The median edit took 5,260.1 ms to ready Changes,
      against 3,990.9 ms for the same edits without editor files. The
      latency varied widely between rounds, but the compile counts did not.
    - Each run used a fresh Serve process and a fresh product cache. So the
      runs measured edits, not restarts. Nobody measured a restart with
      retained editor files.
  - The cost of one head compile at restart, as an estimate:
    - The performance orchestrator measured mokly-cloud on 2026-11-18 at
      `efb17e824`, with 4 vCPUs and pool size 4.
    - A restart after unreverted edits also rejects the head entry and
      compiles the head. It reached `serve.ready` in 4.14 s, against 1.86 s
      for a warm start. It reached first Changes in 15.2 s, against 12.9 s.
    - A restart with changed editor files does the same work. So it should
      cost about 2.3 s more for both measures. Nobody measured it.
  - The exact Serve plan change of branch
    `calummoore/mokly-plan-reuse-editor-files-6dni` adds candidate names:
    - Only the plan check compares a recorded directory on its candidate
      names. Every other check keeps whole directories. The section
      "Candidate Names" of `docs/protocol/mokly-sidecar-plans.md` states
      this rule.
    - So an edit with retained editor files keeps its plan and makes one
      esbuild call. A restart still rejects the head entry. In-process reuse
      still rejects a retained state whose directory changed.
    - The decision in the section "Reuse And Identity" of
      `docs/protocol/mokly-sidecar-recipes.md` stays for compiled and stored
      reuse. A reuse check of a compilation compares whole directory entries,
      so it copies no resolver rule.
  - Why the performance orchestrator chose plan-only candidate names on
    2026-11-18, under the user's delegation of 2026-11-16 for Changes speed
    and reliability:
    - Candidate names copy the lookup rules of one esbuild version. With
      plan-only names, an error in those rules can change only the plan use
      of an edit.
    - Compiled reuse, stored compilations, and bundle cache admission keep
      whole directories. So such an error cannot reach the disk.
    - Its earlier preferred direction put candidate names into the shared
      reuse evidence of every reuse owner. It replaced that direction with
      plan-only names on the same date.
    - It asked for this item and authorized no product change for restart
      reuse. Such work needs a new call.
  - Candidate names in the shared reuse evidence alone cannot restore the
    restart hit of the measured case:
    - They narrow only the captured reuse evidence.
    - The `inputDirectories` list of the Action directory still differs, so
      `reuse()` still rejects the head entry.
    - The `metadataDirectories` list and the `InputStamp` memberships keep
      whole directories too. So the core still rejects a retained state after
      the change.
  - Every option keeps these requirements:
    - A reused compilation gives the output, the recorded inputs, and the
      errors of a fresh compile of the current files.
    - The disk rules of `docs/protocol/mokly-base-cache.md` stay. Only
      complete and stable evidence reaches the disk. The identity,
      publication, receipt, payload, fault, and lock rules keep their
      meaning.
    - A Serve edit captures nothing and stores nothing, as the section
      "Capture Modes" of `docs/protocol/mokly-sidecar-recipes.md` states.
    - Both 8 MiB bounds of `docs/protocol/mokly-sidecar-plans.md` stay.
    - A candidate model applies only to esbuild 0.28.2. A name that is not
      ASCII keeps a whole comparison, as for the plan check.
    - The two stale-selection windows of
      `plans/follow-ups/in-process-resolution-coherence.md` stay detectable.
    - The work adds no setting, gate, retry, or process.
- **Problem:** A Serve restart rejects the head entry when an editor file in
  a consumed-module or recorded directory differs from the capture of that
  entry. The head then compiles with capture, also when no import of the
  stored compilation can select the editor file.
- **Impact if no action:** Each such restart pays one head compile with
  capture. On mokly-cloud that is about 2.3 s more to `serve.ready` and to
  first Changes, by the estimate above. The next restart hits while the
  editor files stay the same.
- **Root question:** How can a Serve restart reuse the stored head
  compilation when only files that no import of that compilation can select
  changed, with the same exactness and disk rules?
- **Options:**
  - **A.** Change nothing. A restart after an editor file appears or leaves
    compiles the head once and stores the new entry. Effort: Small.
  - **B.** Use candidate names in every reuse check, in TypeScript and in
    Rust. This covers the captured reuse evidence and the three
    consumed-directory lists. It changes the rules in the section
    "Reuse And Identity" of `docs/protocol/mokly-sidecar-recipes.md`. An error
    in the candidate rules can then reach compiled reuse and stored bundles.
    Effort: Large.
  - **C.** Use candidate names only when the sidecar checks a restored
    stored compilation. Take the names from the stored plan of the entry.
    In-process reuse and bundle cache admission keep whole directories. The
    restart then hits. A later in-process reuse of that state still sees the
    changed `InputStamp` membership. It changes the same rules for stored
    compilations only. Effort: Large.
  - **D.** Refresh the head entry with one captured head compile while Serve
    is idle. This is the pause compile of
    `plans/follow-ups/serve-pause-warm-head.md`, which owns its design. It
    needs no candidate model. A restart hits when the editor files did not
    change after the last pause compile. It adds scheduling, cancellation,
    and a rule for storing a compilation that no command served. Effort:
    Large.
- **Left out:**
  - Candidate names in the shared reuse evidence alone. It fails the goal,
    because the editor files of the measured case sit in a consumed-module
    directory, whose whole lists stay.
  - Ignore lists of editor file names. They cannot prove that no import
    selects a name, so they fail the exactness requirement.
  - A store of the served edit compile after a check against the last
    captured evidence. It fails the goal, because a full read of that
    evidence fails while an editor file differs from the capture.
  - A capture at each graceful stop, and capture on every edit. The
    performance orchestrator rejected both on 2026-11-18. The section
    "Capture Modes" of `docs/protocol/mokly-sidecar-recipes.md` keeps that
    decision.
- **Wider fix:** B. One candidate model for every reuse owner prevents a miss
  from any name that no import of the compilation can select. It is blocked,
  because it changes requirements in force.
- **Previous examples:** The exact Serve plan change of 2026-11-18 fixed the
  same class for Serve edits only, with plan-only candidate names.
- **Related:**
  - `plans/follow-ups/serve-pause-warm-head.md`, linked alternatives. Its
    pause compile is option D here. This item waits for that decision.
  - `plans/follow-ups/serve-plan-record-start-cost.md`, the same code. Its
    restart profile must separate an editor-file miss from the plan cost. B
    and C change the evidence bytes that it counts.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code. B
    and C narrow the directory evidence that detects its two stale-selection
    windows.
- **Recommendation:** D. It needs no candidate model, and it also warms a
  restart after unreverted edits. C is the smaller candidate option, if
  measured restarts still miss after D.
- **Action:** ask the user, because B and C change the whole-directory rules
  of the compiled recipe contract, D waits for the open decision of
  `plans/follow-ups/serve-pause-warm-head.md`, and the performance
  orchestrator deferred this work on 2026-11-18.
