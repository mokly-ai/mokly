# Marked Serve edit reuse misses link retargets

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from round 1 of the implementation review of the
  branch `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, at commit
  `0fd6eced4`.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts:11` to line
  39, `packages/mokly/src/sidecar/resolution-inputs.ts:50` to line 51,
  `packages/mokly/src/sidecar/module-paths.ts:122`,
  `packages/mokly/src/sidecar/compiled.ts:111`,
  `crates/mokly-sidecar/src/compiled.rs:136` to line 138, and
  `crates/mokly-render/src/bundle_attempt.rs:113`.
- **Reason:** The live checks of `main` record no link target either, and the
  approved scope of the absolute paths fix keeps that limit, so a fix needs
  its own decision.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Marked Serve edit compile:** a head compile that Serve requests with
    `capture: "serveEdit"` after it publishes its first state. It records no
    reuse evidence, and a later `serveEdit` request of the same process can
    reuse it under the live checks alone.
  - **Live checks:** the checks of a marked reuse: equal settings, roots, and
    toolchain identity, unchanged consumed file digests and metadata inputs,
    and unchanged directory lists.
  - **Directory list:** the sorted names of the non-directory entries in one
    folder.
    It holds no entry kind and no link target.
  - **Link retarget:** a symbolic link that is replaced by a link of the same
    name with another target.
  - **Captured evidence:** the reuse evidence of a compile in the `full`
    mode. It keeps every entry of a recorded folder, the kind of each entry,
    and the real target of each link.
- **Background:**
  - Section "Reuse And Identity" of `docs/protocol/mokly-sidecar-recipes.md`
    gives the live checks. Since the absolute paths fix of 2026-11-18, the
    directory lists also hold the folders in which esbuild looks for the
    earlier `paths` targets of each authored bare import.
  - `resolutionInputs`, at `packages/mokly/src/sidecar/resolution-inputs.ts:50`
    to line 51, turns each lookup folder into its real path through
    `ModulePaths.metadata`, at `packages/mokly/src/sidecar/module-paths.ts:122`.
    `directoryFiles`, at lines 11 to 39 of the first file, records only the
    names of the non-directory entries in a folder. So the live checks hold the
    real folder behind a link, not the link and its target.
  - Consumed-module folders follow the same rule on `main`. Their live checks
    never recorded a link target, so the limit predates the absolute paths
    fix.
  - The sidecar runs the live checks in `reuse`, at
    `packages/mokly/src/sidecar/compiled.ts:111`. The core's fast path reuses
    a retained marked result while its stamps stay current. It builds those
    stamps from the same name-only lists, at
    `crates/mokly-render/src/bundle_attempt.rs:113`. The lists are maps from
    a folder to its names in `CompiledGeneration`, at
    `crates/mokly-sidecar/src/compiled.rs:136` to line 138. So a change that
    records link targets changes the data that the sidecar sends to the
    core.
  - Captured evidence differs. Lines 92 to 93 of the same protocol page say
    that a recorded folder keeps the real target of each link, and
    `PhysicalInputs` saves `{ kind: "link", target }` for each link. So
    captured reuse, released recipes, the bundle cache, and Serve plans see a
    retarget.
  - A Mokly probe of 2026-11-18 showed the limit:
    - The fixture had `one/empty/.keep`, `one/ready/value.js` with the value
      `one`, `two/value.js` with the value `two`, and a folder link
      `one/current` to `empty`.
    - The tsconfig mapped the exact key `fixture` to `./one/current/value.js`
      and then to `./two/value.js`. The entry imported `fixture`.
    - The first `serveEdit` compile selected `two`. Its live directory lists
      held the source root, `one/empty`, `one/empty/value.js`, and `two`, all
      as real paths.
    - The probe then replaced `one/current` with a link to `ready`. A fresh
      compile selected `one`, but marked reuse kept `two`.
  - By code reading, `main` also keeps `two` in this probe, because its live
    checks hold no mapped target folder. So the probe shows no regression
    from `main`.
  - The options check of 2026-11-18 for the absolute paths plan put link
    retargets outside its live-folder extension: "The live checks never
    record link targets, also for consumed-module folders today, and
    captured evidence covers retargets." The performance orchestrator
    approved that extension under the user's delegation of 2026-11-16. It
    adds folders to the existing lookup lists, changes no data between the
    sidecar and the core, and keeps each risk of `main` that the new checks
    cannot observe.
- **Problem:** A marked Serve edit compile records the real folder behind a
  link, not the link and its target. When a link on a lookup path or a
  consumed path gets a new target during a live session, a fresh compile can
  select another module or read other content, but marked reuse keeps the
  old module.
- **Impact if no action:** Rarely, Serve keeps an old module after a link
  retarget, such as `npm link` to another checkout or a switch of a linked
  build folder. It keeps it until a JavaScript edit changes a consumed file,
  or until a restart. Captured reuse and the bundle cache stay correct.
- **Root question:** How can marked Serve edit reuse notice a link on a lookup
  path or a consumed path that gets a new target, while normal edit reuse
  stays fast?
- **Options:**
  - **A.** Change nothing. Captured reuse stays correct, and marked reuse
    keeps the limit of `main`. Effort: Small.
  - **B.** Also record the written folder of each lookup path that goes
    through a link in the directory lists. A listing of that folder follows
    the current link, so a retarget that changes the listed names ends the
    reuse, as in the probe. It changes no data format. It misses a retarget
    to a folder with the same names but other content. Effort: Small.
  - **C.** Record the target of each link among the written components of
    each lookup path and consumed path in the live inputs, before the paths
    become real paths. Compare each target at each marked reuse, in the
    sidecar and in the core's fast path. It covers changes of content behind
    a retarget too. It changes the data that the sidecar sends to the core.
    Effort: Medium.
  - **D.** Withhold the marker when a consumed module or a lookup folder of an
    authored import lies behind a link outside the dependency roots. It
    removes marked reuse for linked workspace layouts. Effort: Small.
  - **E.** Move the sidecar and the core to one shared path-and-link
    observation model. Effort: Large.
    - The live checks keep the written components of each lookup path and
      consumed path, with the target of each link among them. Or they
      observe the parent folder of each such link.
    - Only then do the live directory lists use the entry format of the
      captured evidence, with the kind of each entry and the real target of
      each link.
    - The entry format alone is not enough. `resolutionInputs` has already
      turned `one/current` into `one/empty` before it lists any folder, so
      the link is gone from the recorded paths.
    - One model then serves captured and marked reuse. It changes the data
      that the sidecar sends to the core.
- **Left out:**
  - Resolve each import again with esbuild at each reuse check. The compiled
    recipe rules reject a second resolve, because it runs an esbuild
    operation on each reuse.
  - Capture full reuse evidence in Serve edit compiles. The compiled recipe
    rules decided on 2026-11-18 that a Serve edit compile captures nothing,
    so that edits stay fast.
- **Shared assumptions:**
  - Marked reuse keeps its live checks and no captured evidence. Source: the
    decision "a Serve edit compile captures nothing and stores nothing" in
    `docs/protocol/mokly-sidecar-recipes.md`. It holds. Kept.
  - The live checks change no data between the sidecar and the core. Source:
    the approved scope of the absolute paths fix. It binds only that branch.
    C and E drop it.
  - The live checks use real folders only. Source: the code of
    `ModulePaths.metadata`. It keeps identities stable, but it hides links. B
    drops it in part.
- **Wider fix:** E. One shared model of written paths, link targets, and
  folder entries serves both owners, so a later live check cannot miss a
  link again.
- **Previous examples:** `plans/follow-ups/jsconfig-resolution-input.md`
  records another observation that the live checks of a marked compile miss:
  `extends` base files. The absolute paths fix of 2026-11-18 added mapped
  target folders to the live checks.
- **Related:**
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it asks how in-process reuse proves that its evidence describes the view
    from which esbuild selected each module, and it keeps the marked
    exception. This item concerns an observation that the live checks lack,
    not a timing window. Each item can merge alone.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): the same
    class of missing live input. A change of the live-input format can serve
    both items.
- **Recommendation:** C. It covers retargets on lookup paths and consumed
  paths with the link targets that captured evidence already records. B
  misses a retarget with the same names, and D removes reuse for linked
  layouts. E best protects the codebase.
- **Action:** ask the user, because C, D, and E change the marked live-check
  rule of `docs/protocol/mokly-sidecar-recipes.md`, and no recorded decision
  covers that change.
