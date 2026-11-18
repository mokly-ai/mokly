# Reuse compilations that extend a package tsconfig

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the options check of identity call 22 of the
  bundle disk cache plan on branch `calummoore/lisbon-h906`. The check put
  this limitation outside the scope of that change.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts:112` to line 113,
  `packages/mokly/src/sidecar/config-inputs.ts:25` to line 36, and
  `packages/mokly/src/sidecar/resolution-evidence.ts:210` to line 274.
- **Reason:** The bundle disk cache change records only relative `extends`
  targets and keeps the safe fallback for other forms, so wider support is
  new work after its merge.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Reuse evidence:** the record of each file and directory that can change
    how a compiled bundle resolves. A later bundle reuses the compilation
    only while this evidence still matches the filesystem.
  - **Incomplete evidence:** reuse evidence with a gap. Such a compilation is
    never reused and never stored, and it gets a fresh identity at each
    compile. Since 2026-11-18, a marked Serve edit compile is the one
    exception to the reuse rule.
  - **Marked Serve edit compile:** since 2026-11-18, a head compile that
    Serve requests with `capture: "serveEdit"` after it publishes its
    first state. It records no reuse evidence, and its evidence carries the
    marker `uncaptured: "serveEdit"`. A later `serveEdit` request of the
    same process can reuse it under the live checks alone: equal settings,
    roots, and toolchain identity, unchanged consumed file digests, and
    unchanged directory lists. The bundle cache never stores it, and it
    gets a fresh identity at each compile.
  - **Bundle cache:** the OS cache kind that keeps the latest compiled bundle
    of each set of bundle settings across processes.
  - **Package-name `extends`:** an `extends` value that names a file in an
    installed package, such as `@tsconfig/node22/tsconfig.json` or a
    workspace configuration package.
- **Background:**
  - Since 2026-11-16 the sidecar records reuse evidence for each compile. It
    includes each file that a tsconfig `extends` chain names, under the
    section "Compiled Recipes And Release" of
    `docs/protocol/mokly-sidecar-modules.md`.
  - `readConfig` in `packages/mokly/src/sidecar/config-inputs.ts:112` to line
    113 accepts only an `extends` value that starts with `.`. A package name
    or an absolute path throws "unsupported configuration extends".
  - `scope`, at lines 25 to 36 of the same file, catches that error and marks
    the evidence incomplete. The recorder takes this safe path for every form
    that it cannot map.
  - The same section of `docs/protocol/mokly-sidecar-modules.md` sets the
    result for incomplete evidence:
    - The compilation is never reused, also in the same process.
    - The bundle cache never stores it.
    - It gets a fresh identity at each compile. So the core describes the
      bundle again, and the whole-bundle views render again.
    - On 2026-11-18 these rules moved to
      `docs/protocol/mokly-sidecar-recipes.md`, and the performance
      orchestrator added the marked Serve edit compile as one deliberate
      exception, under the user's delegation of 2026-11-16. That edit
      compile records no reuse evidence, so its `extends` chain cannot make
      it incomplete, and it is reused in the same process as above. The
      startup compile of Serve, each strict build, and each base side still
      record the evidence, so they still take this fallback. Such a
      compile gets no reuse in the process, also in a `serveEdit` request.
  - The output stays correct, because each bundle compiles from the current
    files.
  - A package-name `extends` names a file that a `node_modules` lookup from
    the configuration's directory finds. An absolute `extends` names one
    file directly.
  - `ResolutionEvidence` in
    `packages/mokly/src/sidecar/resolution-evidence.ts` already records the
    package lookup of a bare import. `package`, `targets`, and `exports`, at
    lines 210 to 274, record each `node_modules` level, the package
    manifest, and the export targets, with absent candidates and link
    targets.
  - On 2026-11-16 a warm head compile of `examples/basic` took 1.5 s or more
    on the measuring machine. A describe took 0.26 s on 2026-10-30. Every
    `extends` in this repository is relative, so `examples/basic` keeps
    complete evidence.
- **Problem:** A project whose tsconfig `extends` a package or an absolute
  path gets incomplete reuse evidence. It then gets no compilation reuse and
  no bundle cache, and it describes again after each compile. Since
  2026-11-18, this holds for each compile that records the evidence. A
  marked Serve edit compile keeps its reuse in the process.
- **Impact if no action:** Such a project pays the full compile and describe
  cost at each Serve start, each JavaScript rebuild, and each base side. The
  bundle cache gives it no gain. Its output stays correct. Since 2026-11-18,
  a Serve rebuild after the first JavaScript edit can reuse the marked edit
  compile in the process, as on `main`. A rebuild before that edit, each
  Serve start, and each base side keep the cost.
- **Root question:** How does a project whose tsconfig extends a package or
  an absolute path get compilation reuse, with no risk of stale code?
- **Options:**
  - **A.** Change nothing. The safe fallback stays, and such projects keep
    the compile cost. Effort: Small.
  - **B.** Support absolute `extends` targets only. Record an absolute target
    as a relative one is recorded today. Package-name targets keep the
    fallback. Effort: Small.
  - **C.** Support package-name and absolute `extends` targets. Record the
    lookup of a package-name target as the recorder records a bare import:
    each `node_modules` level from the configuration's directory up to the
    package, the package manifest, and the resolved file, with absent
    candidates and link targets. Hash each resolved target into the
    identity, as for a relative target. Keep the incomplete mark for each
    form that the recorder cannot map. Add one reuse test for each form,
    including a package upgrade that moves its link. Effort: Medium.
- **Left out:**
  - Treat a package-name `extends` as complete without its lookup. A package
    upgrade could then keep a stale compilation.
  - Resolve the target again with esbuild at each reuse check. The compiled
    recipe rules reject this, because it runs an esbuild operation on each
    reuse.
- **Wider fix:** C. One recorder then maps the package lookups of imports and
  of configurations alike.
- **Previous examples:** The package lookup evidence of bare imports in
  `ResolutionEvidence`, from the bundle disk cache change of 2026-11-16.
- **Related:**
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): an
    extends target that C records still has the watch and render-key gap of
    that item. Each item can merge alone.
- **Recommendation:** C. It covers the common `@tsconfig` bases and workspace
  configuration packages with the lookup evidence that imports already use.
  It keeps the incomplete mark as the safe fallback.
- **Action:** fix after merge, apply C, because it is new support work
  outside the bundle disk cache change. It keeps every rule of the compiled
  recipe contract, and the current fallback keeps the output correct.
