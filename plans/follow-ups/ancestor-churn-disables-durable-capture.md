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
  `crates/mokly-render/src/edit_plans.rs:60` to line 68,
  `crates/mokly-sidecar/src/durable_recipe.rs:31` to line 35,
  `docs/protocol/mokly-base-cache.md:175` to line 215,
  `docs/protocol/mokly-sidecar-plans.md:71` to line 75 and line 111 to line
  134, and `docs/protocol/mokly-sidecar-recipes.md:32` to line 35.
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
      at `edit_plans.rs:66`. A Serve edit with a current record sends the
      plan and makes no native attempt. It makes one esbuild call when its
      guarded result stands, and never more than two, under the
      [guarded attempt rules](../../docs/protocol/mokly-sidecar-plans.md#guarded-attempts).
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
  - Controlled Rust evidence, from the test
    `serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes`
    in `crates/mokly-render/tests/integration/plan_invalidation_tests.rs`, on
    2026-11-19, before the shared fixture helpers:
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
  - Node evidence, from the strict build tests `tests/static_config_dir.test.ts`
    and `tests/static_absolute_paths.test.ts`, on 2026-11-19, before the
    shared fixture helpers:
    - The same kind of controller changed `/tmp` during the first capture of
      the configDir test. The first rejection was `observe:mature` at `/tmp`,
      with a witness age of 2,298,203 ns against the limit of 50,000,000 ns.
      The unchanged second build then compiled once instead of zero times, at
      line 57 of the test at commit `76386b810`.
    - A change directly in `.context` failed the absolute paths test in the
      same way. Its first rejection was `observe:mature` at `.context`, with a
      witness age of 1,347,471 ns.
    - In both runs, the first capture had `complete: true`, `durable: false`,
      no `uncaptured` marker, a toolchain identity, and no plan. The first CLI
      load found no record, and the pool skipped the save. The unchanged
      build found no record again and compiled once.
    - A natural run, with no controller change, failed the configDir test in
      the same way. Its first rejection was `finish:sameCaptureStat` at
      `/tmp`. The change and modify times of `/tmp` went from
      1795125558060731481 to 1795125559061722230 ns during the capture. Its
      device, inode, and size stayed equal. Nobody identified the writer.
    - A second natural run of the same test passed. These natural runs were
      local test runs, not real use.
    - The configDir test also failed naturally three times on 2026-11-19,
      with no trace. The runs were a local complete gate, CI run 44578048802,
      and the complete gate of the branch
      `calummoore/fu-config-repository-root-symlink-v8zb`. Each time, the
      unchanged build compiled once at line 57. After each of the two gate
      failures, one isolated run of the test passed. After the CI failure,
      attempt 2 of the run reran the failed jobs, and its full Node suite
      passed all 3130 tests.
  - Test isolation and its limit:
    - Two shared helpers give eight tests their own owner folders under
      `target/durable-capture-fixtures` in the checkout.
      `durable_fixture::create(Owner)` in
      `crates/mokly-test-support/src/durable_fixture.rs` serves six Rust
      tests, the nine-case test included. `durableRoot(context, owner)` in
      `tests/helpers/durable_fixture.ts` serves the two Node tests above.
    - Each helper creates the `rust` and `node` folders and every owner folder
      of its runtime before it returns a fixture. Only the owner test creates
      or removes entries in its folder. Each scoped child goes after use, and
      the empty owner folders stay. The anchor is the `target` folder of the
      checkout, also when `CARGO_TARGET_DIR` names another folder.
    - Matching controls with the helpers passed. A change in `target/tmp`
      came during a capture of two `bundle_pool_tests` tests of
      `mokly-compare`. A change in `/tmp` came during the configDir test, and
      a change in `.context` during the absolute paths test. Each capture
      stayed durable, with its plan. The four idle runs passed too.
    - A change inside each source root was still rejected at
      `finish:sameCaptureStat`. Late helper calls changed no active ancestor.
      Four probes made and dropped a fixture of another owner during a
      capture, with the same and the other runtime. During a Rust capture, the
      Node owner folders grew from 0 to 2. During a Node capture, the Rust
      owner folders grew from 0 to 6. Both captures kept their ancestors.
    - With the helpers, the three complete Rust test binaries passed 10 of 10
      runs each. Their tests passed in total: 30 in `bundle_pool_tests`, 10 in
      `config_dir_pool_tests`, and 1030 in `integration_tests` of
      `mokly-render`. Ten paired runs of the two Node test files passed all 20
      tests. No test failed, was ignored or filtered, or was skipped or
      cancelled.
    - The performance orchestrator accepted this mechanism as the reason for
      the fixture isolation. It did not accept it as a trace of the earlier
      natural failures.
    - Before these helpers, the nine-case test used one private folder
      directly in `target`. Controlled runs of that layout made one change
      directly in `.context` and three changes in `target/tmp`. In each run,
      all nine first captures stayed durable, with plans and the required
      saves. An idle run passed too. A change inside a fixture root was still
      rejected, at `finish:sameCaptureStat`.
    - With that layout, the complete test binary passed 10 of 10 runs, with
      103 tests each. No test failed, was ignored, or was filtered. A source
      audit then found no other direct writer of `target` in that test
      binary, and no Cargo build ran beside the tests. This result does not
      trace the natural failure of this test on 2026-11-18, when its "existing
      import" edit sent no plan.
    - The helpers isolate only the changes that fixtures make. Another writer
      can still make a capture not durable. It can write in `target` or in a
      folder above it, such as the checkout folder, the home folder, or `/`.
    - A checkout or worktree inside a `.context` folder still has that
      `.context` folder and its task folder as ancestors of `target`. Agents
      run many worktrees there. The helpers cannot isolate those ancestors
      without a product hook, and no such hook exists. CI and a normal
      checkout do not have such an ancestor.
  - Real use, not measured: a real repository has the same shared ancestor
    folders, such as the home folder. Another program can add or remove an
    entry there during or just before a captured compile. Then the evidence
    is not durable, the bundle cache stores nothing, and Serve edits of those
    settings start with the native attempt. The natural configDir run above
    shows that a shared ancestor can change during a capture with no
    controller. Nobody has seen this in real use or measured how often it
    happens.
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
     decision at `docs/protocol/mokly-sidecar-plans.md:122` to line 125 states
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
  - [serve-plan-editor-invalidation.md](./serve-plan-editor-invalidation.md):
    another cause of the same native-attempt fallback. There, a kept record
    goes stale at the edit check. Here, the first capture keeps no record.
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it records the stale module selections that the durable check keeps out
    of the bundle cache. A narrower witness rule from this task must still
    keep them out.
