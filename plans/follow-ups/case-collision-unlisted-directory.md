# Case collisions in unlisted directories escape reuse checks

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the options check of the exact Serve plan
  change on branch `calummoore/mokly-plan-reuse-editor-files-6dni`, which
  listed this gap outside the plan, and from a read-only source check of the
  gap on the same date. The check read the source at `be242a628` and
  esbuild 0.28.2, and it ran nothing.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts:135` to
  line 149, `packages/mokly/src/sidecar/physical-path-inputs.ts:39` to line 58
  and line 91 to line 104, and the section "Reuse And Identity" of
  `docs/protocol/mokly-sidecar-recipes.md`.
- **Reason:** The gap predates the exact Serve plan change, which keeps the
  current comparisons of recorded inputs, and nobody has reproduced a
  changed output.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory listing, absent
    path, and link that can change how an import of a compiled bundle
    resolves. Each reuse check compares it with the filesystem.
  - **Exact-file observation:** the observation that a recorded path is a
    regular file at its canonical path. The capture records it for an
    existing file with an explicit extension, instead of a listing of its
    directory.
  - **Folded key:** the lowercase form of a name that esbuild uses to look
    up a directory entry. esbuild makes it with Go `strings.ToLower` on
    every platform.
- **Background:**
  - `candidate` at `packages/mokly/src/sidecar/resolution-evidence.ts:135`
    to line 149 skips the directory capture of a base when the base is an
    existing file with an extension other than `.js`, `.jsx`, `.mjs`, or
    `.cjs`.
  - `exactFile` and `canonicalFile` at
    `packages/mokly/src/sidecar/physical-path-inputs.ts:39` to line 58 call
    `capturePath` at line 91 to line 104. They record the canonical path
    as a `filePath` observation, and the lexical links on its path. They save
    no listing of the parent directory.
  - esbuild 0.28.2 looks up directory entries by their folded key. The
    sources are `internal/fs/fs.go` and `internal/fs/fs_real.go` at the
    esbuild tag `v0.28.2`:
    - `DirEntries.Get` in `fs.go`, line 92 to line 95, lowercases each query
      with Go `strings.ToLower` and looks up that key.
    - `fs_real.go` line 155 to line 159 store each entry under its lowercase
      name. A later name with the same key replaces an earlier one.
    - `readdir` in `fs_real.go`, line 350 to line 362, takes the names in
      the order of the filesystem, without sorting. So that order decides
      which of two colliding entries esbuild keeps.
  - esbuild uses the entry that it keeps, in `internal/resolver/resolver.go`
    at the tag `v0.28.2`:
    - Line 1754 to line 1765 accept a file candidate only when the kept
      entry is a file after links. They return the path in the requested
      spelling.
    - Line 1598 to line 1614 take the real path of a directory from the
      kept entry in its parent.
    - Line 848 to line 870 rewrite a resolved path through the kept entry
      when that entry is a link.
  - The condition needs all of these:
    - The directory has no recorded listing and no other observation that
      changes.
    - Two distinct entries share the folded key. The filesystem must allow
      both spellings.
    - The collision changes the kind or the link target that esbuild uses,
      and the order of the filesystem selects the variant.
    - The recorded exact path can stay a canonical regular file.
  - A candidate for a reproduction: a directory or a link that differs only
    in letter case from an exact source path, or a letter-case variant of an
    ancestor that is a link. Its kind or target can differ while the
    original path stays present. This is a hypothesis from the source.
    Nobody ran it.
  - Reuse checks run in the sidecar, in the core, and for stored bundle
    cache entries. So a missed variant can also reach a later process.
  - Limits of the evidence:
    - Nobody reproduced a stale output, a wrong module, or a hidden error.
    - A new ordinary file with another letter case does not by itself select
      other bytes, because esbuild returns the requested spelling. Go case
      folding alone does not prove a different output.
    - A recorded whole listing already rejects a new letter-case variant. A
      rename or a removal of the recorded exact path fails the existing path
      check.
  - The exact Serve plan change compares candidate names without ASCII
    letter case, and a non-ASCII entry rejects a narrowed plan. The section
    "Candidate Names" of `docs/protocol/mokly-sidecar-plans.md` states the
    rule. It covers recorded directories only, so its plan check has the
    same gap in an unlisted directory.
- **Problem:** The evidence of an exact-file import observes no other entry
  that shares the folded key of the path, in a directory without a recorded
  listing. Such an entry can appear after the capture without rejecting
  reuse.
- **Impact if no action:** Rarely, on a filesystem that allows both
  spellings, a reused compilation could differ from a fresh compile. This
  needs an entry that changes the kind or the link target that esbuild
  uses. Nobody has shown such a case.
- **Root question:** How does the reuse evidence observe a letter-case
  variant that can change what esbuild finds at an exact path without a
  recorded listing?
- **Options:**
  - **A.** Change nothing. The gap stays. Effort: Small.
  - **B.** Reproduce first. Compare the full reused result with a fresh
    native-first compile, and save the effective entry order and the actual
    kind or link effect. Then record, for the exact path and each ancestor
    that esbuild reads, each entry that shares the folded key: its name, its
    kind, and its link target. Keep a whole listing where a name is not
    ASCII. Effort: Large.
  - **C.** Record the whole listing of the parent of each exact path. It is
    exact and simple. An unrelated new entry beside an exact file then
    rejects reuse. It reduces the reuse of `main`, so it needs the user.
    Effort: Medium.
- **Left out:** A match without letter case in Rust or JavaScript alone. It
  fails the goal for non-ASCII names, because esbuild folds letter case with
  Go rules, which differ from Rust and JavaScript.
- **Wider fix:** None. The class is each esbuild read that the capture does
  not model. Only a trace of the reads of esbuild would prevent it, and the
  esbuild API gives no such trace.
- **Previous examples:** The exact Serve plan change of 2026-11-18 handles
  letter case in recorded directories with the rule in the section
  "Candidate Names" of `docs/protocol/mokly-sidecar-plans.md`.
- **Related:**
  - `plans/follow-ups/pnp-ancestor-manifest-evidence.md` and
    `plans/follow-ups/link-target-kind-evidence.md`, the same code: the
    reuse evidence capture and its checks. Each item has its own cause, so
    one branch can take them together.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code.
    It owns changes during a compile. This item owns a change after a
    completed capture.
  - [ignored-module-path-spelling.md](./ignored-module-path-spelling.md),
    the same cause in the Git status reader. Two spellings of one name on a
    volume that folds case hide an `ignored-module` warning there. Its
    option D reads the stored name of each path part, as option B here
    reads the entries that share the folded key.
- **Recommendation:** B. It keeps the reuse of `main`, and the reproduction
  shows whether a collision can change a result at all.
- **Action:** fix after merge, apply B, because the gap predates the exact
  Serve plan change, nobody reproduced a changed output, and the
  reproduction decides the exact observation.
