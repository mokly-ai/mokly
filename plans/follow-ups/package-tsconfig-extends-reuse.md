# Reuse compilations that extend a package tsconfig

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the options check of identity call 22 of the
  bundle disk cache plan on branch `calummoore/lisbon-h906`. The check put
  this limitation outside the scope of that change. Extended on 2026-11-18,
  from design item 4 of the absolute paths reuse evidence plan on branch
  `calummoore/mokly-absolute-paths-evidence-fix-zqzl` and from the options
  check of this item, with the remaining risk of marked Serve edit compiles.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts:148` to line 149,
  `packages/mokly/src/sidecar/config-inputs.ts:34` to line 48,
  `packages/mokly/src/sidecar/resolution-evidence.ts:183` to line 218,
  `packages/mokly/src/sidecar/serve-edit-paths.ts:43` to line 44, and
  `packages/mokly/src/sidecar/serve-edit-paths.ts:104` to line 116.
- **Reason:** The bundle disk cache change records only relative `extends`
  targets and keeps the safe fallback for other forms, so wider support is
  new work after its merge. The absolute paths fix keeps the marker of a
  chain that the reader cannot read, so its marked risk waits for the same
  reader work.

- **Source:** Review.
- **Category:** Product bug.
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
    installed package, such as `@tsconfig/node22/tsconfig.json`, a
    workspace configuration package, or `expo/tsconfig.base`.
- **Background:**
  - Since 2026-11-16 the sidecar records reuse evidence for each compile. It
    includes each file that a tsconfig `extends` chain names, under the
    section "Compiled Recipes And Release" of
    `docs/protocol/mokly-sidecar-modules.md`.
  - `readConfig` in `packages/mokly/src/sidecar/config-inputs.ts:148` to line
    149 accepts only an `extends` value that starts with `.`. A package name
    or an absolute path throws "unsupported configuration extends". It
    throws before it reads the local `compilerOptions`, so the sidecar reads
    no setting of such a chain, local or inherited.
  - `scope`, at lines 32 to 45 of the same file, catches that error and marks
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
  - The output of a compile with incomplete evidence stays correct, because
    each bundle compiles from the current files.
  - A package-name `extends` names a file that a `node_modules` lookup from
    the configuration's directory finds. An absolute `extends` names one
    file directly.
  - `ResolutionEvidence` in
    `packages/mokly/src/sidecar/resolution-evidence.ts` already records the
    package lookup of a bare import. `package`, `targets`, and `exports`, at
    lines 192 to 256, record each `node_modules` level, the package
    manifest, and the export targets, with absent candidates and link
    targets.
  - On 2026-11-16 a warm head compile of `examples/basic` took 1.5 s or more
    on the measuring machine. A describe took 0.26 s on 2026-10-30. Every
    `extends` in this repository is relative, so `examples/basic` keeps
    complete evidence.
  - Since the absolute paths fix of 2026-11-18, the live checks of a marked
    Serve edit compile also cover the folders in which esbuild looks for the
    `paths` targets of each authored bare import. They cover each target up
    to the selected one. On a package fallback, they cover every target and
    the `baseUrl` candidate. When an alias gives the import an absolute
    target, esbuild falls back to that written path, and they cover every
    target. Section "Reuse And Identity" of
    `docs/protocol/mokly-sidecar-recipes.md` holds this rule.
    `ServeEditPaths.accept` and `finish` in
    `packages/mokly/src/sidecar/serve-edit-paths.ts` add these folders after
    the compile.
  - The sidecar adds these folders only when it can read the whole
    configuration chain that defines the mapping and its base folder. In
    native esbuild, a local `paths` map replaces the inherited map as a
    whole, also under a package `extends`. The sidecar cannot use this,
    because its reader stops at the package `extends`.
  - For a chain with a package `extends`, `ServeEditPaths.scope`, at lines
    142 to 154 of that file, gives no settings, and lines 88 to 89 skip the
    import. The compile then adds no folders for any `paths` or `baseUrl` of
    the chain, local or inherited, and it keeps its marker and the live
    checks of `main`. The performance orchestrator chose this on 2026-11-18,
    under the user's delegation of 2026-11-16. Withholding the marker would
    remove edit reuse from common catalogues, such as those that extend
    `expo/tsconfig.base`. F, G, and H each change this marked live-check
    rule in `docs/protocol/mokly-sidecar-recipes.md`, so the performance
    orchestrator approves that change.
  - Probes of 2026-11-18 show the forms that keep this marked risk. Native
    esbuild 0.28.2 probes showed how esbuild reads inherited settings, and
    Mokly probes showed what marked reuse then serves:
    - A package base sets `baseUrl`, and that `baseUrl` anchors the targets
      of a local `paths` map. A local `baseUrl` overrides the base one.
    - An import that no `paths` key matches resolves from an inherited
      `baseUrl` before the package lookup. The package base
      `sharedcfg/base.json` set `baseUrl` to `${configDir}/src`, and the
      project's tsconfig extended it with a local `paths` map. The bare
      import `theme` selected `node_modules/theme/index.js`. After
      `src/theme.js` appeared, a fresh compile selected `src/theme.js`, but
      marked reuse kept the package module.
    - A package base supplies `paths` when the local tsconfig has none. The
      base `expo/tsconfig.base` mapped `@/*` to `../../one/*` and then to
      `../../two/*`, and the local tsconfig only extended it. The first edit
      compile selected `two`. After the `one` target appeared, a fresh
      compile selected `one`, but marked reuse kept `two`.
    - A local `paths` map under a package base that sets no `paths` and no
      `baseUrl`, the shape of the Expo template. The base set only `strict`,
      and the local map sent `@/*` to `./src/*`. The import `@/ui` selected
      `src/ui/index.js`. After `src/ui.js` appeared, a fresh compile
      selected it, but marked reuse kept `src/ui/index.js`. The same local
      map without the package `extends` compiled again.
  - The live inputs of a marked compile hold no `extends` base file. So a
    change of the base file also leaves the old module in marked reuse.
    `plans/follow-ups/jsconfig-resolution-input.md` records the probe for a
    relative base. By code reading, a package upgrade that changes the base
    acts the same.
  - No probe covers the esbuild lookup order or the `exports` conditions of
    a package-name `extends`, or how `expo/tsconfig.base` resolves. So a
    reader that copies the esbuild lookup rests on code reading only.
  - Loss of reuse and stale output differ:
    - Loss of reuse, with correct output: each compile that records evidence
      for such a chain. These are the Serve start, the head compiles before
      the switch, each base side, `build`, and `publish`. Each gets no
      captured reuse, no released recipe, no bundle cache entry, and a fresh
      identity.
    - Stale output: marked Serve edit reuse in one live process, for every
      `paths` map and `baseUrl` of such a chain, inherited or local. A file
      that appears at an earlier candidate causes it, and so does a change
      of the base file. It lasts until a JavaScript edit changes a consumed
      file, or until a restart.
- **Problem:** A project whose tsconfig `extends` a package or an absolute
  path gets incomplete reuse evidence. It then gets no compilation reuse and
  no bundle cache, and it describes again after each compile. Since
  2026-11-18, this holds for each compile that records the evidence. A
  marked Serve edit compile keeps its reuse in the process. But its live
  checks cover no target folder and no base file of such a chain. A file
  that appears at an earlier candidate, or a change of the base file, can
  then leave the old module in place.
- **Impact if no action:** Such a project pays the full compile and describe
  cost at each Serve start, each JavaScript rebuild, and each base side. The
  bundle cache gives it no gain. Since 2026-11-18, a Serve rebuild after the
  first JavaScript edit can reuse the marked edit compile in the process, as
  on `main`. A rebuild before that edit, each Serve start, and each base side
  keep the cost. Rarely, Serve keeps an old module after a file appears at an
  earlier candidate of such a chain, or after a change of its base file, such
  as a package upgrade. It keeps it until a JavaScript edit changes a
  consumed file. A restart compiles again, because such a project gets no
  captured reuse.
- **Root question:** How does a project whose tsconfig extends a package or
  an absolute path get compilation reuse, with no risk of stale code?
- **Options:**
  - **A.** Change nothing. The safe fallback stays, and such projects keep
    the compile cost. The marked stale output stays. Effort: Small.
  - **B.** Support absolute `extends` targets only. Record an absolute target
    as a relative one is recorded today. Package-name targets keep the
    fallback and the marked risk, and marked reuse still misses a base
    change. Effort: Small.
  - **F.** Read package-name and absolute `extends` targets with an exact
    reader that resolves each package base as native esbuild does. Record
    the lookup of a package-name target as the recorder records a bare
    import: each `node_modules` level from the configuration's directory up
    to the package, the package manifest, and the resolved file, with absent
    candidates and link targets. Hash each resolved target into the
    identity, as for a relative target. Give the effective `paths` and
    `baseUrl` to the marked live checks too. Add each base file and manifest
    to the live inputs of a marked compile, so that the checks also cover a
    change of the base. Keep the incomplete mark and the current marked
    fallback for each form that the reader cannot map. Add one reuse test
    for each form, including a package upgrade that moves its link. A parity
    miss gives complete but wrong evidence. Effort: Large.
  - **G.** Read package-name and absolute `extends` targets with a superset
    reader. Effort: Large.
    - For each package-name target, read every base that the esbuild lookup
      can choose: each `node_modules` level, the package manifest, every
      `exports` target under every condition, and each file-name candidate.
    - Record each candidate with absent files and link targets. Hash each
      present base into the identity.
    - Use the union of their `paths` and `baseUrl` values. Capture records
      every matching target and every `baseUrl` candidate.
    - The marked live checks add the folders of every matching target and
      base folder, and each candidate base file and manifest.
    - Keep the incomplete mark for each form that the reader cannot list.
    - A wrong lookup order then costs reuse, not output. It costs more
      reads, and less reuse when two candidate bases exist. It still needs a
      native probe that lists the candidate forms.
  - **H.** Repair the marked live checks only. Use the reader of G in
    `ServeEditPaths` for a chain with a package or absolute `extends`. Add
    the folders of every matching target and base folder, and each candidate
    base file and manifest, to the live inputs. Keep the marker and the
    incomplete fallback of captured compiles. It removes the stale output
    now, and captured reuse stays lost. It costs a few more reads after each
    edit compile of such a project. Effort: Medium.
  - **I.** Observe the configuration files that esbuild opens. Run
    `esbuild-wasm` with a file-system shim on a small entry in each folder
    whose chain has a package `extends`. Record each file that it opens or
    misses, and read the selected base. Give the files and the mapping to
    both reuse owners, as G does. It copies no lookup rule. It costs a new
    dependency, a shim, and one more esbuild run for each such capture.
    Nobody has checked that a shim sees each read. Effort: Large.
  - **J.** Make Mokly the one owner of the effective mapping. Resolve every
    `extends` form in Mokly, and give the result to esbuild, for example
    through a resolve plugin. Add each base file to the live inputs, as G
    does. The evidence and the selection then use one mapping. It changes
    the selected module where nested configurations differ. It also changes
    the native attempt rule of `docs/protocol/mokly-sidecar-plans.md`, so it
    needs the user. Effort: Large.
- **Left out:**
  - **C.** Support package-name and absolute `extends` targets with the
    limited recorder of 2026-11-16. It records the lookup of a package-name
    target as the recorder records a bare import, and it keeps the
    incomplete mark for each form that it cannot map. Effort: Medium. It
    fails the goal of no stale code: a lookup that is not the esbuild
    lookup can read another base file, and the marked live checks would
    then trust a mapping that esbuild does not use. G keeps the aim of C
    without that flaw.
  - Treat a package-name `extends` as complete without its lookup. A package
    upgrade could then keep a stale compilation.
  - Resolve the target again with esbuild at each reuse check. The compiled
    recipe rules reject this, because it runs an esbuild operation on each
    reuse.
  - Withhold the marker when the sidecar cannot read an inherited mapping.
    The performance orchestrator rejected this on 2026-11-18, because it
    removes edit reuse from common package-extends catalogues.
  - Withhold the marker only when a readable package base supplies `paths`
    or `baseUrl`. H is better on every point: it needs the same reader, and
    it keeps the edit reuse that this variant removes.
- **Shared assumptions:**
  - The marker stays for a chain that the sidecar cannot read. Source: the
    performance orchestrator's call of 2026-11-18, under the user's
    delegation of 2026-11-16. Its reason holds: withholding the marker
    removes edit reuse from default Expo catalogues. Kept.
  - A reader must choose one base file, so it must match the esbuild lookup
    exactly. Source: the text of F and of C. The reason does not hold,
    because an extra folder or file in the evidence costs only reuse, never
    output. G drops it.
  - The marked live checks need target folders only, not configuration
    files. Source: the first text of F and the live-check list of
    `docs/protocol/mokly-sidecar-recipes.md`. The reason does not hold,
    because a base change leaves the old module. F, G, H, I, and J drop it.
  - Captured reuse and the marked repair ship together. Source: the text of
    F. It is not a requirement. H drops it.
  - esbuild discovers each configuration, and the sidecar copies the result.
    Source: section "Native And Planned Attempts" of
    `docs/protocol/mokly-sidecar-plans.md`. It holds. J drops it, so J needs
    the user.
  - A reuse check runs no esbuild operation, and the sidecar writes no file.
    Source: `docs/protocol/mokly-sidecar-recipes.md` and
    `docs/protocol/mokly-sidecar-modules.md`. Both hold. Kept.
- **Wider fix:** G. It still prevents the class when the esbuild lookup order
  or its conditions change. F must know those details, so it is closer to a
  direct fix.
- **Previous examples:** The package lookup evidence of bare imports in
  `ResolutionEvidence`, from the bundle disk cache change of 2026-11-16. The
  mapped target folders of readable configurations in the marked live
  checks, from the absolute paths fix of 2026-11-18.
- **Related:**
  - [Workspace layout extensions](./package-tsconfig-layout-extends.md)
    can share package configuration lookup with this item. It uses the
    inherited `rootDir` and `outDir` in the JavaScript and CSS layout rules.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): an
    extends target that F or G records still has the watch and render-key
    gap of that item. That item also records the missing base files in the
    live inputs of a marked compile for a relative base. F, G, H, I, and J
    add the package base files. Each item can merge alone.
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    its option E is the same kind of esbuild observer as I. Each item can
    merge alone.
- **Recommendation:** G. It gives captured reuse and removes the marked stale
  output, also after a base change, and a lookup-order miss costs only
  reuse. With F, a parity miss gives complete but wrong evidence, so every
  captured owner, the bundle cache included, could serve stale output. H can
  come first when the owner wants the stale output removed sooner, and G
  then reuses its reader.
- **Action:** fix after merge, apply G, because a superset package reader for
  both reuse owners is Large new support work outside the absolute paths fix.
  The current fallback keeps the captured output correct, and the marked risk
  needs a new earlier candidate or a base change during one live session.
