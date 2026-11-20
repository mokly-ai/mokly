# Overlapping reachable PnP roots add folder checks

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from finding 5 of round 2 of the implementation
  review of the branch `calummoore/mokly-folder-export-evidence-7rox`, at
  commit `18c3827cd` against `main` at `c2fe4bf2a`. The finding check of the
  same round proposed the reachable-root filter. The fresh options check of
  the design item added the kept state-file observation.
- **Location:** `PnpLocations.roots` in
  `packages/mokly/src/sidecar/pnp-locations.ts`, `PackageFolders.lookup` in
  `packages/mokly/src/sidecar/package-folders.ts`, `PnpInputs.capture` in
  `packages/mokly/src/sidecar/pnp-inputs.ts`, and the section "PnP Package
  Roots" of `docs/protocol/mokly-sidecar-folder-reuse.md`.
- **Reason:** The user reserved the choice of B and any retirement of this
  item, and the measurement of 2026-11-20 found no real overlap.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **PnP root:** a package location that the Yarn PnP registry lists for a
    package reference. The registry lives in the PnP state file:
    `.pnp.data.json`, or the state that `.pnp.cjs` embeds.
  - **Reachable root:** a PnP root whose reference, or an alias to it, is the
    target of the requested name in the dependencies of a registry package
    that contains a folder from which the import resolves, of the top-level
    package, or of the fallback pool.
  - **Overlap:** two or more reachable roots of one importer and request
    whose package maps can place the same physical module.
  - **Evidence owners:** the `full` capture, which records folder evidence
    before resolution, and the marked checks, which record live folders and
    private folder files after a Serve edit compile.
  - **Folder checks:** the folders and files that an evidence owner records
    for a selection through a package folder mapping. A change in them ends
    reuse.
- **Background:**
  - Native PnP resolution in esbuild 0.28.2 finds one parent package for the
    importer. That parent is the package whose location is the longest
    prefix of the importer folder. esbuild reads the dependency entry of that
    parent for the requested name. It uses the fallback pool only when the
    parent has no entry. In the esbuild source, `resolveToUnqualified` and
    `findLocator` in `yarnpnp.go` hold this rule.
  - Mokly does not copy that rule. `PnpLocations.roots` gives the roots of
    the requested name and its aliases from the pinned registry. Both
    evidence owners use it:
    - `PackageFolders.lookup` serves the marked checks and the final audit
      of the `full` capture.
    - `PnpInputs.capture` serves the `full` capture before resolution.
  - A root counts when its folder contains the selected module.
    `PackageFolders` merges the candidates of every root that counts. So the
    folder mapping of one root can add checks to a module that another root
    selects.
  - The confirmed base layout, from a proof run against the branch:
    - The registry lists two references of one name. The outer root is
      `.yarn/chosen/`, and its `exports` maps `./sub/` to `./inner/lib/`.
    - The inner root lies inside the outer one. Its exact export selects
      `inner/lib/value/index.js`.
    - The top-level package lists only the inner reference. No package
      lists the outer one.
    - Fresh native output stays `original-index` after `inner/lib/value.ts`
      appears. So esbuild used the inner exact export.
  - Before the reachable filter, the outer folder mapping also placed that
    selection:
    - The marked checks added `inner/lib` and `inner/lib/value` to the live
      folders.
    - They recorded three private files: the outer manifest,
      `inner/lib/value/package.json`, and `.pnp.data.json`.
    - An unrelated file kept reuse. A new `inner/lib/value.ts` ended reuse,
      although the native output stayed `original-index`.
  - The branch now keeps only reachable roots in both owners. The filter is
    an in-memory pass over the pinned registry. It adds no read, no budget,
    and no native operation. It covers each folder from which the import
    resolves, also the folder of a second resolve under the module source
    rules, or it keeps every root of the name for that resolve.
  - When the filter removes a root whose folder mapping matches the request,
    both owners drop its folder checks but keep their observation of the PnP
    state file. In the base layout, the outer root is unreachable. So a new
    `inner/lib/value.ts` now keeps reuse, and a change of the registry ends
    it. The marked private table holds the state file also for this ordinary
    import.
  - A proof run showed why the state file stays. With the filter alone, a
    registry-only edit made the outer root the native owner. After a
    preferred file appeared, native output became `preferred-file`, but both
    modes reused the stale `original-index`. The kept state-file observation
    ends that reuse.
  - A residual stays. A package around the importer, the top-level package,
    or the fallback pool can list a second root of the same name whose map
    can place the selected module. Both roots are then reachable and
    overlap, and the unused one still adds its folder checks. Examples:
    - a root workspace that has the name of the dependency and references
      itself,
    - a `portal:` reference into a subfolder of a workspace with that name.
  - Yarn rejects two workspaces with one name, so the proof registry was
    synthetic. Real layouts can still nest two locations of one name, as in
    the examples. Before the measurement of 2026-11-20, nobody had measured
    how often they occur.
  - Native output never changes, because esbuild still selects the module.
    The cost is one extra compile after each change in the extra folders.
  - Decisions in force:
    - On 2026-11-19 the performance orchestrator chose to index the registry
      locations as a bounded superset. It chose not to copy the PnP locator,
      fallback, or ignore rules.
    - On 2026-11-20 the performance orchestrator chose the reachable-root
      superset, under the user's delegation. Reliability comes before speed.
      A sound superset never omits a real folder candidate. That call
      accepts the overlap residual as a narrow exception to unchanged
      ordinary reuse.
    - Later on 2026-11-20, the performance orchestrator extended that call.
      Both owners keep the PnP state-file observation when the filter
      removes a matching folder root. A registry change must end reuse, and
      an irrelevant sibling in the removed root must not.
    - On 2026-11-20 the user authorized only the measurement below and a
      change of this item. The user reserved the choice of B and any
      retirement of this item. B and C wait for that answer.
  - `docs/protocol/mokly-sidecar-folder-reuse.md`, section "PnP Package
    Roots", states the rule, the overlap exception, and the kept state-file
    observation.
  - On 2026-11-20 a measurement ran the steps that this item planned. Its
    setup:
    - It measured product commit
      `586e74a3ca01f688a45fb98343317ccfec0e6999` with Node v24.22.1 and
      esbuild 0.28.2 on Linux x64. `main` at `cc0750d36` had no change in
      `packages/mokly` or in that protocol doc.
    - A local diagnostic, off by default, ran two copies of
      `packages/mokly/src` from that commit. The baseline copy stayed
      unchanged. The instrumented copy added only observer calls.
    - The observers sat in the resolve callback of `ResolutionEvidence`, in
      `PnpInputs.capture`, around `PackageFolderLookups.accept`, and in
      `PackageFolders.lookup`. They recorded each importer, request, and
      root, with its reachable flag.
    - The observers called no resolver, and both copies made the same
      resolver calls. The diagnostic kept every metadata, evidence, wire,
      and disk limit, and it added no telemetry.
    - Each input was a list of real entry files of one project. The sidecar
      function `bundle` compiled it in the `full` and the `serveEdit`
      capture modes. The input had empty module resolution settings, the
      project root as its package root, no stories, and no renderer.
    - Each public project ran under its own `.pnp.cjs`, loaded with
      `node --require`, so that Node can read the ZIP archives of the Yarn
      cache.
  - The counts and the output checks of the measurement:
    - A pair is one importer file, by its real path, and one bare request
      name after the configured aliases. All compiles of one mode count
      each pair once.
    - The `full` denominator holds each pair whose request reached
      `PnpInputs.capture` with a pinned state file. The marked denominator
      holds each pair whose request reached `PackageFolderLookups.accept`.
    - Both denominators keep requests with one root and requests without a
      physical selected module. They leave out built-in modules, plugin
      requests, `#` imports, and importers without a physical file.
    - The `full` denominator also leaves out each request that comes after
      its capture became incomplete.
    - The numerator holds each pair in which two or more different
      reachable root paths can place the module that the native compile
      selected.
    - A root places that module when one of its candidate files has the
      same real path. After the compile, the product's own package-map and
      candidate code gave the candidates, for every condition.
    - An exact export gives its own file and its TypeScript source
      rewrites. A folder mapping gives the folder, main-field, extension,
      and index candidates. A root that only contains the module does not
      place it.
    - A root without `exports` gives the main-field, extension, and index
      candidates of its subpath. It does not count as a folder mapping.
    - The union merges the pairs of both owners. It keeps only an overlap
      that one owner proved. It never joins one root of each owner.
    - Two more counts help to read the numerator. The canonical count
      merges root paths that share one real path. The folder count keeps
      only overlaps in which a placing root uses a folder mapping.
    - Each run compiled the same input again with the baseline copy. Native
      parity compares the result, the files, and the errors of each native
      compile. Final parity compares the final compiled code.
    - Both comparisons replace only the random key `mokly:runtime:` and its
      48 hex digits. The sidecar makes a new key for each compile.
  - The controls of the measurement:
    - Two synthetic projects copy the base layout into a `.pnp.data.json`
      registry. Two importers request `chosen/sub/value`. One of them also
      imports `ordinary`, a package with one root and one exact export.
    - In the selected-exact control, the top-level package lists the inner
      reference, and the fallback pool lists the outer one. The
      selected-folder control swaps the two references.
    - Each control ran in both modes. It added an unrelated file, then
      `inner/lib/value.ts`. It checked reuse after each step, then compiled
      again.
    - Both controls started at 2/3 in each owner and in the union. The
      `ordinary` pair stayed in the denominator.
    - The unrelated file kept reuse in all four runs. The new
      `inner/lib/value.ts` ended reuse in all four runs.
    - In selected-exact, fresh native output stayed `original-index`, and
      the count stayed 2/3. Here the end of reuse is the extra compile of
      this item.
    - In selected-folder, fresh native output became `preferred-file`, and
      the count fell to 0/3. Only the outer root can place the new file, so
      its folder checks are real.
    - All eight output comparisons, before and after the edit, matched the
      fresh baseline. Each control compile was one native compile.
    - Four more controls started from selected-exact:
      - A third reachable root contains the module but maps it to another
        file. Each owner counted 2/3, so containment alone did not count.
      - A symbolic link gives the inner root a second registry path. Each
        owner counted 2/3 raw, 0/3 canonical, and 0/3 folder.
      - An extra `react` import gave `full` 2/4 and the marked checks 2/3.
        `full` kept the request without a physical selected module.
      - An unresolved bare import failed both copies with the same error.
        `full` counted 0/4 before the failure, and the marked checks 0/0.
  - The public graphs of the measurement. Each count is overlap pairs over
    classified pairs:
    - Each clone stayed at its upstream commit, with an immutable install,
      `--mode=skip-build`, and a clean `git diff`. Each project uses the
      Yarn default `nodeLinker: pnp`.
    - Clipanion, `arcanis/clipanion` at
      `434b5a6e0063c58b5e2f0a62498a7de0b308308f`, Yarn 4.4.1, entries
      `sources/advanced/index.ts` and `demos/advanced.ts`: `full` 0/3,
      marked 0/3, union 0/3.
      - Native and final parity passed. The `full` capture was complete.
        The marked evidence had its normal `uncaptured: "serveEdit"` state.
      - Each pair had one reachable root and a physical selected module.
      - `sources/advanced/Cli.ts` imports `clipanion/platform` through the
        self-reference of the root workspace `clipanion`. The registry also
        lists `clipanion` 2.6.2 from npm, and the filter marked it
        unreachable.
      - The `typanion` pair of `sources/advanced/Command.ts` also had an
        external import edge in each compile, next to its physical
        selection.
    - Typanion, `arcanis/typanion` at
      `2ad80a170ce6aa4808a0c2b00da951611b67b9b8`, Yarn 4.0.0-rc.2, entry
      `tests/index.test.ts`, compiled but not run: `full` 0/12, marked 0/1,
      union 0/12.
      - The pairs are the `chai` import of the test and 11 requests inside
        Chai and `deep-eql`. Each pair had one reachable root.
      - Native compiles and native parity passed in both modes. Then both
        copies failed to make the recipe: `The "path" argument must be of
type string. Received type number (30)`.
      - The failure comes from the ZIP file system of that old Yarn loader.
        Its promise `FileHandle.stat` passes a numeric file descriptor to a
        path operation. No patch was applied.
      - So the graph is partial. The marked count is a prefix, and no final
        output comparison exists.
    - eslint-plugin-arca, `arcanis/eslint-plugin-arca` at
      `80b19434860ab183b687a147c165ae66adb6829f`, Yarn 3.8.7, entries
      `sources/rules/curly.ts` and
      `sources/rules/newline-after-import-section.ts`: `full` 0/0, marked
      0/0, union 0/0.
      - Native and final parity passed. The package imports of these rules
        are types, which the compile removes.
    - React JSON Doc, `arcanis/react-json-doc` at
      `ca5eb6f754a4c02de6dbdfd15f8c4d1ba056c982`, Yarn 4.10.3, entry
      `sources/index.tsx`: `full` 0/2, marked 0/0, union 0/2.
      - Native and final parity passed.
      - The pairs are `react` and `react/jsx-dev-runtime`, each with one
        reachable root. Mokly's handling of the React peer gives neither a
        physical selected module, so neither can show overlap.
    - In each mode, each of these four graphs had one successful native
      compile, then one successful non-native compile. The sidecar runs
      that second compile when it cannot keep the native result.
  - The excluded attempts of the measurement. These graphs failed in both
    copies. They give no count, not even a zero count:
    - Berry, `yarnpkg/berry` at `a9edb7777f04ba16f51503ef6775325b353b67cc`,
      entry `packages/plugin-npm/sources/npmProvenance.ts`. Its `yarnPath`
      runs source Yarn 4.9.2-dev. Its `packageManager` pins bootstrap Yarn
      4.2.1.
      - Through `@sigstore/sign` and `tuf-js`, the graph uses the real
        portal `make-fetch-happen` at `portal:packages/make-fetch-smaller`.
        The portal name differs from the name of its target workspace.
      - The native compile failed on the optional `supports-color` import
        of `debug`.
      - Its `.pnp.cjs` of 2,598,987 bytes also exceeds the 1 MiB limit for
        one metadata file. The `full` capture was incomplete from its first
        bare request. Neither owner classified a pair.
    - The first inputs of Typanion, Clipanion, and Arca included their
      Rollup configuration, which pulls in TypeScript. They failed on its
      optional `source-map-support` import.
    - Typanion's TypeScript and Arca's `sources/rules/import-absolutes.ts`
      also failed on `pnpapi`.
    - Arca's real test `tests/rules/curly.test.ts` imports a rule through
      the root self-reference `eslint-plugin-arca: link:./`. It failed on
      the optional `supports-color`, `jiti`, and `jiti/package.json`
      imports of `debug` and ESLint.
  - The limits of the measurement:
    - No real overlap appeared. Only Clipanion gave a complete nonzero
      count, of three pairs. Typanion is partial, React JSON Doc is
      peer-only, and Arca has no pairs.
    - Do not add the rows into one rate. A prefix, a zero denominator, and
      a peer-only row are not complete samples.
    - A failed graph or a 0/0 row does not show that overlap is absent.
    - The sample is small and chosen by hand. Four projects belong to the
      GitHub account `arcanis`. The fifth is the Yarn repository.
    - The graphs are library, demo, and test sources, not Mokly catalogues.
      So the sample cannot give the prevalence of overlap in catalogues or
      in the Yarn ecosystem.
    - No successful graph had a layout of the residual examples. In
      Clipanion, the second root of the self-referenced name was
      unreachable. The Arca self-reference test and the Berry portal graph
      failed.
    - A positive count shows shared placement only. It does not name the
      native owner. In selected-folder, the overlapping outer root was the
      owner, so its checks were real.
    - The placement reads assume that the project does not change during
      one run.
    - The diagnostic code and the raw results stay outside Git, under
      `.context/overlapping-reachable-pnp-roots/` in the workspace that ran
      the measurement. This item does not depend on them.
- **Problem:** When reachable roots overlap, an import that native
  resolution selects without a folder mapping still gets the folder checks
  of another root's mapping. A change in those folders ends its reuse,
  although the selection stays the same.
- **Impact if no action:** A catalogue with such a layout compiles again
  after changes that change no selection. Output stays correct.
- **Root question:** How can each evidence owner add the folder checks of
  only the PnP root that native resolution selects, without ever missing a
  real candidate?
- **Options:**
  - **A.** Keep the current reachable-root superset with its kept state-file
    observation. Overlapping reachable roots keep their conservative checks.
    Effort: Small.
  - **B.** Model exact native PnP ownership. It must copy the longest-prefix
    parent, raw location keys, repeated keys with their first-key and
    overwrite rules, aliases, discard flags, ignore patterns, and fallback
    exclusions. It falls back to the reachable superset at each step that
    stays unclear. It keeps the state-file observation, because a registry
    edit can change the owner. A wrong parity rule can drop the real
    candidates and keep a stale module. It reverses the 2026-11-19 choice not
    to copy the locator, fallback, and ignore rules. Effort: Large.
  - **C.** Take package ownership from the native compile, and keep the
    state-file observation for registry edits. The pinned esbuild interface
    exposes no such result, so this needs a fork or an upstream change.
    Effort: Large.
- **Left out:**
  - Deepest-root selection: it can miss an outer mapping into an inner
    package, which keeps a stale module.
  - No marker for overlapping roots: it keeps the performance defect.
  - A resolve at each reuse: it breaks the reuse contract.
  - The runtime API of `.pnp.cjs`: it runs project JavaScript, and a
    `.pnp.data.json` file has no runtime.
- **Wider fix:** C, with the registry dependency of the PnP state file. It
  selects the one native owner, so no unused root adds checks, and a registry
  edit still ends reuse. B is a direct fix, which needs exact parity or the
  reachable superset at each unclear step.
- **Previous examples:** Finding 2 of the same review round added the
  package-root check by containment of the selected module. Finding 5 found
  the unused nested-root regression of the base layout.
- **Recommendation:** A, for the current code. The measurement found no
  real overlap, and B is a Large change in which one wrong parity rule can
  keep a stale module. The first recommendation was B, after a measurement
  that shows overlap in real catalogues, because its superset fallback keeps
  every real candidate. Consider B again only after a real catalogue shows
  overlap and the user approves B. B then needs its own parity proofs and a
  new call that reverses the 2026-11-19 choice. C best protects the
  codebase, if esbuild exposes package ownership.
- **Action:** ask the user, because the user asked to decide both the Large
  option B and any retirement of this item. The user gave this rule on
  2026-11-20, when they authorized only the measurement.
