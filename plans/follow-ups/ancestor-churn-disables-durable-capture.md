# Unrelated ancestor changes can disable durable capture

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, at the request of the performance orchestrator, from
  the controlled ancestor churn runs of the Rust plan test investigation on
  branch `calummoore/mokly-flaky-saved-plan-test-5sod`.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts:170` to
  line 202, `packages/mokly/src/sidecar/physical-inputs.ts:172` to line 219,
  `packages/mokly/src/sidecar/physical-input-reader.ts:110` to line 129,
  `packages/mokly/src/sidecar/capture-paths.ts:59` to line 112,
  `packages/mokly/src/sidecar/capture-durability.ts:57` to line 65, line 110
  to line 117, and line 153 to line 211,
  `packages/mokly/src/sidecar/capture-runtime.ts:76` to line 121,
  `crates/mokly-render/src/edit_plans.rs:41` to line 49,
  `crates/mokly-sidecar/src/durable_recipe.rs:31` to line 35,
  `docs/protocol/mokly-base-cache.md:175` to line 215,
  `docs/protocol/mokly-sidecar-plans.md:43` to line 49 and line 75 to line
  98, and `docs/protocol/mokly-sidecar-recipes.md:32` to line 35.
- **Reason:** The performance orchestrator deferred this real-use
  investigation and authorized no product change in the branch that found
  the mechanism, which changes no product code.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Capture witness:** the identity and change stamps of one folder or
    metadata file that a captured compile used. The sidecar reads them again
    after the compile.
  - **Mature:** a witness whose change time is at least 50 ms old when the
    sidecar first observes it. With whole-second stamps, the limit is 2.1 s.
  - **Durable evidence:** reuse evidence whose witnesses were all mature at
    their first observation and unchanged after the compile.
  - **Absent lookup:** a path that resolution can try but that does not
    exist, such as a `node_modules` folder in an ancestor folder. The
    evidence records it as absent.
  - **Plan record:** the resolution plan of one captured compile, which the
    core of a Serve head keeps with the reuse evidence of that compile.
- **Background:**
  - A Mokly build or Serve session runs a Rust core and Node sidecars. A
    sidecar runs esbuild. A captured compile, in the `full` capture mode,
    also returns reuse evidence: the files, folder lists, and absent paths
    that resolution read.
  - Serve's head sends captured compiles only until it publishes its first
    state, at `docs/protocol/mokly-sidecar-recipes.md:32` to line 35. Its
    later edits record no reuse evidence.
  - What durable evidence enables:
    - The bundle cache, the disk cache of compiled bundles, admits only a
      compilation with complete and durable evidence, at
      `durable_recipe.rs:31` to line 35. A later process can then load the
      compilation instead of compiling again.
    - The core keeps a plan record only from complete and durable evidence,
      at `edit_plans.rs:47`. A Serve edit with a current record sends the
      plan and makes one esbuild call.
    - Without a record, the edit starts with the native attempt, in which
      esbuild resolves each import itself. A planned attempt can follow.
      `docs/protocol/mokly-sidecar-plans.md` states these rules.
  - Evidence that is not durable is a safe refusal, because it only removes
    reuse. It keeps every in-process reuse rule. But a later process cannot
    load the compilation, and no Serve edit reuses its plan. Mokly prints
    nothing for this. Section "Stable Capture" of
    `docs/protocol/mokly-base-cache.md` states this rule. It also says that an
    unrelated change in a folder on the path to a recorded input can prevent
    the store.
  - Why every ancestor folder is a witness:
    - For each bare import, the sidecar records a `node_modules` candidate in
      every ancestor folder of the importer, up to `/`, at
      `resolution-evidence.ts:170` to line 189. It does this also when a
      nearer folder holds the package. An absent candidate becomes an absent
      input, at `physical-inputs.ts:172` to line 197.
    - For each recorded path, absent paths included, `pathLinks` visits each
      parent folder up to `/`, at `physical-inputs.ts:199` to line 219. Each
      existing folder becomes a witness through `linkTarget`, at
      `physical-input-reader.ts:118`. `CapturePaths.walk` does the same for
      each existing path that the sidecar resolves, at `capture-paths.ts:59`
      to line 112.
    - So the witnesses include the repository folder and each folder above
      it, such as the home folder and `/`. The stamps of a folder change when
      an entry is created, removed, or renamed directly in it.
    - `CaptureDurability.observe` rejects a witness that is not mature, at
      `capture-durability.ts:166`. `finish` rejects a witness whose device,
      inode, change time, or modify time changed, at line 185 to line 211.
      Each rejection makes the evidence not durable. Before the compile,
      `prepare` waits once, for at most 50 ms, when a stamp is recent.
  - Controlled evidence, from the Rust test
    `serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes`
    in `crates/mokly-render/tests/integration/plan_invalidation_tests.rs`, on
    2026-11-19:
    - A local diagnostic paused the sidecar after its durability `prepare`
      step. A controller then created and removed one folder directly in one
      ancestor folder of the fixture. Then the sidecar went on. The
      diagnostic was removed after the runs.
    - With the fixtures directly in `target/tmp`, a change in `target/tmp`
      failed each of three cases: "content", "existing import", and "new
      module". Each first capture had `complete: true`, `durable: false`, no
      `uncaptured` marker, a toolchain identity, and no plan.
    - In those three runs, the first rejection was `observe:mature` at
      `target/tmp`, with a witness age of about 2.2 ms. The core kept no plan
      record, and the bundle store got no save.
    - The "content" and "existing import" edits then sent no plan and made
      two esbuild attempts. A planned edit makes one. The "new module"
      fixture never saved, so its mock store reported the missing save.
    - With the fixtures in a private folder in `.context`, a change directly
      in `.context` failed the "content" case. The first rejection was
      `observe:mature` at `.context`, with a witness age of 3,612,506 ns
      against the limit of 50,000,000 ns.
    - That capture had the same flags as above. The test stopped with status
      101 at its check that the first capture is durable and returns a plan.
    - An idle controller, which changed nothing, passed. Without a
      controller, the complete test binary passed 10 of 10 runs, and 3 more
      diagnostic runs passed. All 30 traced first captures of those
      diagnostic runs were durable.
    - These runs show the mechanism. They do not show the cause of any
      earlier natural failure.
  - Test isolation and its limit:
    - The nine-case test creates its fixtures in one private folder directly
      in the `target` folder of the checkout, also when `CARGO_TARGET_DIR`
      points elsewhere.
    - Controlled runs of this layout made one change directly in `.context`
      and three changes in `target/tmp`. In each run, all nine first captures
      stayed durable, with plans and the required saves. An idle run passed
      too. A change inside a fixture root was still rejected, at
      `finish:sameCaptureStat`.
    - With this layout, the complete test binary passed 10 of 10 runs, with
      103 tests each. No test failed, was ignored, or was filtered. This
      result does not trace the natural failure of this test on 2026-11-18,
      when its "existing import" edit sent no plan.
    - This isolation holds only while nothing but the test changes the
      `target` folder. A source audit found no other direct writer of
      `target` in that test binary, and no Cargo build runs beside the tests.
      The checkout folder, the home folder, and `/` stay shared and
      witnessed.
    - A checkout or worktree inside a `.context` folder still has that
      `.context` folder and its task folder as ancestors of `target`. Agents
      run many worktrees there. The test cannot isolate those ancestors
      without a product hook, and no such hook exists. CI and a normal
      checkout do not have such an ancestor.
  - Real use, not measured: a real repository has the same shared ancestor
    folders, such as the home folder. Another program can add or remove an
    entry there during or just before a captured compile. Then the evidence
    is not durable, the bundle cache stores nothing, and Serve edits of those
    settings start with the native attempt. Nobody has seen this in real use
    or measured how often it happens.
- **Task:**
  1. Reproduce and trace on a real repository with a Mokly catalogue. Run
     Serve with a bundle cache, once idle and once with controlled changes in
     an ancestor folder, such as the home folder. Time each change to fall in
     a first captured compile, as the controlled Rust runs did.
  2. For each capture, record `complete`, `durable`, the first rejected
     witness, its check, its path, and its age.
  3. Measure these values in each run:
     - the plan records that the core keeps
     - the saves that the bundle cache admits
     - the Serve edits that start with the native attempt, and the esbuild
       attempts of each edit
     - the peak memory of the core and the sidecars
  4. Keep each run within safe limits. Check the free memory and disk space
     before each run. Stop a run before either gets low. Remove each folder
     that a controller makes.
  5. Evaluate whether each ancestor witness of an absent lookup is necessary
     for coherence. Coherence means that a kept plan or a stored compilation
     never keeps a module selection that a fresh compile would change. The
     decision at `docs/protocol/mokly-sidecar-plans.md:85` to line 88 states
     this need. Record the evidence for each kind of witness.
  6. Make no product change. Give the results to the performance
     orchestrator. Ask it before any change to a durability requirement in
     `docs/protocol/mokly-base-cache.md` or
     `docs/protocol/mokly-sidecar-plans.md`.
- **Impact if no action:** When another program changes an ancestor folder
  during the first captured compiles, Serve edits lose plan reuse for the
  rest of the session. The bundle cache also stores nothing, so a later
  process compiles again. Mokly shows no message. Nobody knows how often this
  happens.
- **Needs:** A real repository with a Mokly catalogue. A machine where
  controlled changes in an ancestor folder are safe. Local diagnostics that
  are removed after the runs. An answer of the performance orchestrator
  before any product change.
- **Done when:** This item records the idle and churn measurements and the
  coherence evaluation, and the performance orchestrator has answered
  whether a durability requirement changes.
- **Related:**
  - [flaky-static-config-dir-unchanged-reuse.md](./flaky-static-config-dir-unchanged-reuse.md):
    one suspected source of that flaky test is a change in `/tmp`, an
    ancestor of its fixture. That source would be a case of this rule, but
    nobody confirmed it. A trace of either item can inform the other. Each
    item can merge alone.
  - [serve-plan-editor-invalidation.md](./serve-plan-editor-invalidation.md):
    another cause of the same native-attempt fallback. There, a kept record
    goes stale at the edit check. Here, the first capture keeps no record.
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it records the stale module selections that the durable check keeps out
    of the bundle cache. A narrower witness rule from this task must still
    keep them out.
