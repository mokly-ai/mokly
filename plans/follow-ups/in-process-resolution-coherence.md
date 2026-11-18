# In-process reuse can keep a stale module selection

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the options check of design call 30 of the
  bundle disk cache change on branch `calummoore/lisbon-h906`. The check put
  this in-process exposure outside the new functionality of that call and
  asked for a follow-up item.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:106`,
  `packages/mokly/src/sidecar/resolution-evidence.ts:135` to line 143,
  `packages/mokly/src/sidecar/physical-inputs.ts:166`, and
  `crates/mokly-render/src/bundle.rs:63`.
- **Reason:** The exposure predates the bundle disk cache change, which keeps
  it out of the disk cache, except in the documented limit of the durable
  check when every witness returns unchanged. Its fix that keeps all reuse is
  Large.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory list, absent path,
    and link that decides which file each import of a compiled bundle
    selects.
  - **Open lookup:** an import whose file the resolver picks from several
    candidates, such as an extensionless path, an index file, or a package
    in a `node_modules` level.
  - **In-process reuse:** a later `bundle` request, or the core's bundle fast
    path, that serves an earlier compilation of the same process after a
    reuse check.
  - **Durable check:** the private check that decides whether the bundle
    cache may store a compilation. It reads the change stamps of each
    directory and metadata file that the capture touches.
  - **Bundle cache:** the OS cache kind that keeps the latest compiled bundle
    of each set of bundle settings for later processes.
- **Background:**
  - The sidecar compiles the catalogue JavaScript with esbuild in `bundle()`,
    in `packages/mokly/src/sidecar/bundle.ts`. One call runs a native
    attempt, then a planned or a full attempt when the native result needs
    one.
  - `ResolutionEvidence` in
    `packages/mokly/src/sidecar/resolution-evidence.ts` records the
    candidates of each import in an esbuild `onResolve` callback, before
    esbuild resolves that import. `PhysicalInputs` in
    `packages/mokly/src/sidecar/physical-inputs.ts` owns every read. After
    the last attempt, `finish()` reads the whole evidence again. A
    difference makes the evidence incomplete.
  - `reuse()` at `packages/mokly/src/sidecar/compiled.ts:106` accepts an
    earlier compilation while its toolchain, settings, dependency roots,
    consumed file digests, consumed directory lists, and complete reuse
    evidence still match. The core's bundle fast path checks the same
    evidence at `crates/mokly-render/src/bundle.rs:63`.
  - The section "Compiled Recipes And Release" of
    `docs/protocol/mokly-sidecar-modules.md` states the rules. A compilation
    is reused only while its inputs stay unchanged. An incomplete
    compilation is never reused and never stored, and it gets a fresh
    identity at each compile.
    - On 2026-11-18 these rules moved to
      `docs/protocol/mokly-sidecar-recipes.md`. On the same date, the
      performance orchestrator added one deliberate exception, under the
      user's delegation of 2026-11-16. After Serve publishes its first
      state, each head preparation sends `capture: "serveEdit"`. Such an
      edit compile records no reuse evidence. Its evidence carries the
      marker `uncaptured: "serveEdit"`, with `complete` and `durable`
      false. A later `serveEdit` request of the same process reuses it
      under the live checks of `main` alone: equal settings, roots, and
      toolchain identity, unchanged consumed file digests, and unchanged
      directory lists. In the same mode, the core's fast path also reuses
      it while its stamps stay current. A `full` request never reuses it,
      the bundle cache never stores it, and it still gets a fresh
      identity. An unmarked incomplete compilation is still never reused.
      So a marked compilation keeps the exposure of `main` that the next
      bullet describes.
  - Before the bundle disk cache change, `main` at commit `f380e9462`
    recorded the consumed directory lists after the compile, in
    `resolutionInputs` of `packages/mokly/src/sidecar/resolution-inputs.ts`.
    Its `reuse()` had no reuse evidence and no completeness check. So any
    change during a compile could reach in-process reuse there.
  - Two windows remain in process:
    - Transient window: a higher-priority candidate disappears after the
      capture lists its directory and before esbuild reads it. It returns
      before `finish()`. esbuild compiles the lower candidate, but the
      evidence and the filesystem both list the higher one.
    - Cached-listing window: esbuild reads and caches a directory listing at
      its first lookup there, for the whole build. An exact-file lookup at
      `packages/mokly/src/sidecar/resolution-evidence.ts:135` to line 143
      records the file path and no listing. A later open lookup in the same
      directory records the listing through
      `packages/mokly/src/sidecar/physical-inputs.ts:166`. A candidate that
      appears between the two reads enters the evidence, but not the
      selection of esbuild.
  - Two real esbuild regressions in `tests/sidecar_capture_mutations.test.ts`
    show both windows in process, with esbuild 0.28.2 on Linux:
    - "a transient higher candidate keeps live reuse but cannot produce a
      durable recipe" renames `values/value.ts` away after the capture of
      `./values/value`, and back after the compile.
    - "an exact lookup witnesses the directory before esbuild caches a later
      open lookup" creates `values/value.ts` after esbuild resolves
      `./values/marker.ts` and before it resolves `./values/value`.
    - Each test asserts that esbuild selects `values/value.js`, that the
      evidence stays complete, that `reuse()` accepts the compilation in
      process, and that `durable` is false. The tests leave
      `resolveExtensions` empty, so the default order of esbuild ranks `.ts`
      before `.js`.
    - In the fail-first run, each test failed at its `durable` assertion
      with `true !== false`. So the earlier assertions passed there: esbuild
      selected the lower candidate, and the evidence was complete. With the
      durable check, both tests passed in 10 of 10 runs.
  - The second test shows the esbuild listing cache: esbuild selects
    `values/value.js` although `values/value.ts` exists when it resolves
    `./values/value`. Nobody read the Go source of esbuild, so no other
    esbuild version or platform is checked.
  - On 2026-11-17, the bundle disk cache change closed a third window for
    every consumer. All attempts of one `bundle()` call now share one
    evidence owner, so a lasting change between attempts makes the evidence
    incomplete. Before that change, the test "a higher candidate added
    between compile attempts makes evidence incomplete" in
    `tests/sidecar_capture_window.test.ts` failed with `true !== false`.
  - On 2026-11-17, the same change added the durable check, for the disk
    only. A sidecar that serves a pool with a bundle cache records
    witnesses. A witness holds the stamps and the identity of one directory
    or metadata file at its first touch. After `finish()`, the sidecar reads
    each witness again. A change, a stamp younger than its age guard, or an
    unsupported volume leaves the `durable` field of the reuse evidence
    false. The age guard is 50 ms, or 2.1 s for stamps in whole seconds. The
    bundle cache stores only a compilation with complete and
    durable evidence.
  - On 2026-11-18 the performance orchestrator recorded a limit of the
    durable check, with no product fix. A path can be replaced and restored
    after its first observation, inside one timestamp tick of the file
    system. This needs the identity and the stamps of each witness to return
    to their first values, and the evidence to match the files at the final
    read. The durable check then passes. So the bundle cache can store a
    compilation whose selection came from the intermediate state, as in the
    transient window. The age guard keeps a fresh change from passing as an
    old first observation, but it does not exclude such a change after the
    first observation. Its likelihood is Rare: both changes of the path must
    fall inside one tick after its first observation, and every checked
    identity and stamp must return to its first value. No production case is
    known, and nobody has shown that this case caused a test failure or a
    stale output. The section "Stable Capture" of
    `docs/protocol/mokly-base-cache.md` states the limit.
  - The durable check never changes `complete`, the identity, or in-process
    reuse. Two in-process reuse tests of `main` depend on that. One is
    "evaluation-only bundles share compilation and fresh workers restore
    captured code" in `tests/sidecar_generation_reuse.test.ts`. The other is
    `missing_import_repair_manual_rebuild_and_pool_setting_rejection_keep_the_live_state`
    in `crates/mokly-cli/tests/serve_js/watch_tests.rs`. It asserts one
    compile after a manual rebuild, also on the macOS and Windows CI jobs.
  - The resolver reads its extension order, main fields, conditions, and
    package roots from the bundle settings, through `resolutionOptions` in
    `packages/mokly/src/sidecar/resolution.ts`.
  - The fix must keep these goals:
    - No stale code: a compilation is reused only while it equals a fresh
      compile of the current files. Since 2026-11-18, a marked Serve edit
      compile is a deliberate exception: the orchestrator gave it the live
      checks of `main`, which do not prove this. This item keeps that
      exception. A fix that also covers marked compilations needs a new
      decision, because the orchestrator removed capture from edit
      compiles for edit time.
    - Every coherent compilation keeps its reuse, and each complete
      compilation keeps a deterministic identity. An option that reduces
      that reuse removes functionality of `main`, so it needs the user.
    - The sidecar performs no file writes, and a reuse check runs no esbuild
      operation. The first rule is in
      `docs/protocol/mokly-sidecar-modules.md`, and the second is in
      `docs/protocol/mokly-sidecar-recipes.md`.
    - Capture memory stays within its 8 MiB bounds, and no retry is added.
- **Problem:** In-process reuse can accept a compilation whose evidence
  describes a newer filesystem view than the one from which esbuild selected
  a module. The transient window and the cached-listing window allow it. The
  durable check keeps such a compilation out of the disk cache only, except
  in its limit of 2026-11-18, when every witness returns unchanged.
- **Impact if no action:** Rarely, Serve or a build keeps an old module after
  a candidate changes during a compile. It keeps it until a change to a
  recorded input forces a compile. A restart compiles again, because on a
  supported volume the bundle cache does not store such a compilation. The
  one exception is the limit of the durable check, when every witness
  returns unchanged.
- **Root question:** How does in-process reuse prove that the evidence of a
  compilation describes the filesystem view from which esbuild selected each
  module, without less reuse for a coherent compilation?
- **Options:**
  - **A.** Change nothing. In-process reuse keeps both windows, and the
    durable check keeps them out of the disk cache, except in its documented
    same-stamp limit, which is Rare. Effort: Small.
  - **B.** Clear `complete` when a witness of the durable check sees a change
    during the compile. Keep reuse when the check cannot decide, for example
    on an unsupported volume. An unrelated change in a witnessed ancestor,
    such as the home or the temporary directory, then removes reuse and
    forces a describe. A change inside one coarse clock tick can still pass.
    It reduces the reuse of `main`, so it needs the user. Effort: Small.
  - **C.** Clear `complete` whenever the durable check fails. This also
    removes reuse after each recent edit, on each unsupported volume, and in
    each process without a bundle cache. It breaks the two reuse tests above
    after a recent edit. It needs the user. Effort: Small.
  - **D.** Bind each actual resolved winner to the captured candidates at
    the capture boundary. For each open lookup, rank the captured candidates
    with the precedence rules of the resolver. The rules cover relative
    paths, extensions, index files, `paths`, `baseUrl`, each `node_modules`
    level, and the `main`, `module`, and `exports` targets. When the winner
    is not the first present candidate, mark the evidence incomplete. It
    reads no stamp, and it keeps the reuse of each coherent compilation. A
    wrong rank mostly shows as a visible miss, because esbuild then
    disagrees when both candidates exist. One test for each lookup form must
    prove that a coherent compilation stays complete. The two regressions in
    `tests/sidecar_capture_mutations.test.ts` then expect incomplete evidence
    and no in-process reuse, which is the intended change. Effort: Large.
  - **E.** As D, but rank with the resolver of esbuild itself, over the
    captured view in memory, through `esbuild-wasm` and a filesystem shim.
    It copies no precedence rule. It adds a dependency, a shim, and one more
    esbuild run to each compile. Effort: Large.
  - **F.** Compile and capture from one immutable snapshot of the inputs. It
    removes both windows in process and on disk. It needs sidecar file
    writes, and it moves source, dependency, and path ownership. It needs
    the user. Effort: Large.
  - **G.** Write the captured topology and metadata under a mirror root, and
    resolve each open edge there once with esbuild. A different winner marks
    the evidence incomplete. It needs sidecar file writes, a second resolve
    for each open edge, and the right to create links on Windows. It needs
    the user. Effort: Large.
- **Left out:**
  - Change events from inotify or another platform service. macOS and
    Windows give no delivery barrier. Each compile needs thousands of Linux
    watches from a shared per-user limit, which can starve the watchers of
    Serve or an editor.
  - One re-resolve after the compile. The same transient state can occur
    during both resolves.
  - A second resolve at each reuse. The compiled recipe rules forbid an
    esbuild operation on reuse.
  - Locks. They cannot stop external edits.
  - A check that the winner is still present. The winner stays present in
    both windows.
  - D without precedence rules, which requires each winner to be the only
    present candidate. Nested `node_modules` levels and packages with both
    `main` and `module` targets then lose reuse, so it fails the reuse goal.
  - A witness from mtime alone. tar, rsync, and `utimes` restore an mtime,
    and a coarse clock can repeat a stamp.
- **Wider fix:** F. One immutable view then feeds both esbuild and the
  evidence, so neither window can exist. It is blocked, because the sidecar
  performs no file writes. D is the best option that is not blocked.
- **Previous examples:**
  - The attempt window, fixed on 2026-11-17 by one evidence owner for all
    attempts in `packages/mokly/src/sidecar/bundle.ts`. Its test is in
    `tests/sidecar_capture_window.test.ts`.
  - The preview selection race, fixed on 2026-11-17. The virtual entry uses
    the preview selection that the capture recorded. Its test is "preview
    selection uses the captured observation across a temporary deletion" in
    `tests/sidecar_preview_evidence.test.ts`.
  - Consumed bytes that change during a compile, fixed on 2026-11-17. A
    later metadata read keeps the digest of the bytes that esbuild consumed.
    Its tests are "a preview edit during compilation cannot replace its
    consumed digest" and "an imported manifest restored during compilation
    keeps its consumed digest", in the same file.
- **Related:** `plans/follow-ups/serve-plan-editor-invalidation.md` considers
  narrower directory evidence. Its choice must still detect the two
  stale-selection windows in this item.
  `plans/follow-ups/sequential-evidence-capture-cost.md` measures
  this capture boundary and can change its schedule. The ranking work of this
  item must remain possible, and the scheduling measurement must include it.
- **Recommendation:** D. It closes both windows in process and on disk
  without stamps, keeps the reuse of each coherent compilation, and writes
  no file. E copies no rule, but it adds a dependency and an esbuild run to
  each compile. D compares each selected winner with the captured
  candidates and reads no stamp, so it also covers the limit of the durable
  check when the selection changed.
- **Action:** fix after merge, apply D, because the exposure predates the
  bundle disk cache change, the durable check keeps it out of the disk
  cache except in its documented same-stamp limit, which is Rare, and D is
  Large new work at the capture boundary.
