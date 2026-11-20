# Reuse evidence omits the followed kind of links

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the options check of the exact Serve plan
  change on branch `calummoore/mokly-plan-reuse-editor-files-6dni`, which
  listed this gap outside the plan, and from a read-only source check of the
  gap on the same date. The check read the source at `be242a628` and
  esbuild 0.28.2, and it ran nothing.
- **Location:** `crates/mokly-sidecar/src/compiled.rs:51` to line 60,
  `packages/mokly/src/sidecar/physical-input-reader.ts:173` to line 185,
  line 238 to line 242, and line 243 to line 261, and
  `crates/mokly-render/src/physical_inputs.rs:95` to line 131, and
  `crates/mokly-render/src/plan_directory.rs:32` to line 65.
- **Reason:** The gap predates the exact Serve plan change, which keeps the
  current comparisons of recorded inputs, and nobody has reproduced a
  changed output.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory listing, absent
    path, and link that can change how an import of a compiled bundle
    resolves. Each reuse check compares it with the filesystem.
  - **Followed kind:** whether the object at the end of a link is a file or
    a directory.
  - **Canonical target:** the real path of a link after every link on the
    way is followed.
- **Background:**
  - `PhysicalEntry` at `crates/mokly-sidecar/src/compiled.rs:51` to line 60
    keeps the exact name of a directory member, its kind without following
    links, and the canonical target of a link. It keeps no followed kind.
  - `readDirectory` in `packages/mokly/src/sidecar/physical-input-reader.ts`
    records a link member as `kind: "link"` with its canonical target, at
    line 173 to line 185. It does not record whether the target is a file or
    a directory.
  - The TypeScript check `current` in the same file compares a recorded
    directory by name, kind without following links, and target, at line
    243 to line 261. Its check of a standalone link, at line 238 to line
    242, compares only that the path is a link with the same canonical
    target.
  - The Rust check in `crates/mokly-render/src/physical_inputs.rs` reads the
    kind of each member with `file_type`, which does not follow a link, at
    line 102. Line 118 to line 126 compare the canonical target. Line 128 to
    line 131 check a standalone link. Neither compares the followed kind.
    The plan-only directory check in
    `crates/mokly-render/src/plan_directory.rs:32` to line 65 uses the same
    kind and canonical-target facts.
  - esbuild 0.28.2 uses the followed kind. The sources are
    `internal/fs/fs_real.go` and `internal/resolver/resolver.go` at the
    esbuild tag `v0.28.2`:
    - `fs_real.go` line 415 to line 444 follow a link and take the kind of
      its target: a directory, or else a file.
    - `resolver.go` line 1759 accepts a file candidate only when that kind
      is a file.
  - The condition needs all of these:
    - The link and its canonical target path stay the same.
    - The object at that target changes between a directory and a file after
      the capture.
    - No separate observation of the target file, no listing of the target
      directory, no consumed-file check, and no other directory membership
      rejects the change.
  - A candidate for a reproduction: a link with a preferred extension, such
    as `value.ts`, whose target is a directory. esbuild skips it, so the
    lower candidate `value.js` wins. Then a regular file replaces that
    directory at the same target path. The recorded link entry stays the
    same, and esbuild would now prefer `value.ts`. This is a hypothesis from
    the source. Nobody ran it.
  - Reuse checks run in the sidecar, in the core, and for stored bundle
    cache entries. So a missed change can also reach a later process.
  - Limits of the evidence:
    - Nobody reproduced a stale output, a wrong module, or a hidden error.
    - Not every linked winner can change kind unseen. A separate `filePath`
      or `file` observation checks the kind of a file. A recorded listing of
      the target directory rejects a replacement by a file. A link that
      moves to another canonical target fails the existing link checks.
    - The durability check of a capture observes directories and link paths
      while the compile runs. Its witnesses end with the capture and are not
      reuse evidence. So they cannot detect a change after the capture.
  - The exact Serve plan change compares the kind and the link target of
    each compared entry as the reuse evidence records them, in the section
    "Candidate Names" of `docs/protocol/mokly-sidecar-plans.md`. So its plan
    check has the same gap.
- **Problem:** A recorded link keeps no followed kind. So when the object at
  an unchanged canonical target changes between a file and a directory, the
  recorded link stays the same. Reuse continues only under the condition
  above: no separate observation of the target and no directory membership
  check sees the change.
- **Impact if no action:** Rarely, a reused compilation could keep a module
  that a fresh compile would replace, when a preferred candidate behind a
  link becomes a file. Nobody has shown such a case.
- **Root question:** How does the reuse evidence detect that the object
  behind an unchanged link changed between a file and a directory?
- **Options:**
  - **A.** Change nothing. The gap stays. Effort: Small.
  - **B.** Reproduce first, with a stable change of an unselected candidate
    after the capture. Show which canonical target, link entries, consumed
    inputs, and metadata stay equal. Then add the followed kind to each
    recorded link, in directory members and in standalone link
    observations. Compare it in the TypeScript and Rust checks. It changes
    the `PhysicalEntry` and `PhysicalInput` boundary types and their
    generated TypeScript types. Effort: Medium.
  - **C.** Record an observation of each link target: a `filePath`
    observation for a file, or a listing for a directory. It is exact. It
    adds a listing for each linked directory, such as each linked package in
    `node_modules`. So it adds evidence bytes and rejects reuse more often.
    Effort: Medium.
- **Left out:** None. The three options cover the only places: no change, a
  new fact on each link, or a new observation of each target.
- **Wider fix:** None. The class is each esbuild read that the capture does
  not model. Only a trace of the reads of esbuild would prevent it, and the
  esbuild API gives no such trace.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/pnp-ancestor-manifest-evidence.md` and
    `plans/follow-ups/case-collision-unlisted-directory.md`, the same code:
    the reuse evidence capture and its checks. Each item has its own cause,
    so one branch can take them together.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code.
    It owns changes during a compile. This item owns a change after a
    completed capture.
- **Recommendation:** B. It keeps the reuse of `main` and adds one fact to
  each recorded link.
- **Action:** fix after merge, apply B, because the gap predates the exact
  Serve plan change, nobody reproduced a changed output, and the
  reproduction decides the smallest exact change.
