# Marked paths checks change shared render keys

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the options check of the private folder file
  table, on branch `calummoore/mokly-folder-export-evidence-7rox`, against
  `main` at `f4f0082fd`.
- **Location:** `packages/mokly/src/sidecar/serve-edit-paths.ts:105` to line
  115 and line 138, `packages/mokly/src/sidecar/resolution-inputs.ts:64` to
  line 75, `packages/mokly/src/sidecar/bundle.ts:195` to line 196,
  `crates/mokly-render/src/render_environment.rs:110`, and
  `crates/mokly-graph/src/render_inputs.rs:139` to line 155. The line numbers
  are at `main` commit `f4f0082fd`.
- **Reason:** The private table that would fix this is authorized only for
  package folder mappings, so its use for `paths` mappings needs its own
  decision.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Marked compile:** a Serve edit compile with `capture: "serveEdit"` that
    keeps the `uncaptured: "serveEdit"` marker. A later `serveEdit` request of
    the same process can reuse it under its live checks alone.
  - **Metadata inputs:** the `metadataInputs` field of a compiled recipe. It
    holds resolution files by logical name, each with a digest when present
    or null when absent. Its present files key renders.
  - **Reuse evidence:** the cache-only `reuseEvidence` field of a compiled
    recipe. Only reuse checks read it, and it moves no render input key.
  - **Shared key digest:** one digest that enters every render input key of a
    side. It holds the present resolution files that lie on no consumed
    module's chain.
- **Background:**
  - Serve switches its head to the `serveEdit` capture mode after its first
    published state. The base side, `build`, and `publish` use the `full`
    mode.
  - A marked compile records no full reuse evidence. Its live checks are the
    consumed file digests, the metadata inputs, and the directory lists.
  - Only a `serveEdit` compile creates `ServeEditImports`, at
    `packages/mokly/src/sidecar/bundle.ts:195` to line 196. Its `record` runs
    `ServeEditPaths.record` of `packages/mokly/src/sidecar/serve-edit-paths.ts`.
  - That pass reads each source-side bare import that matches a TypeScript
    `paths` key of a readable configuration chain. It walks the mapped
    targets in order, up to the selected module.
  - For each earlier target that does not hold the selected module, it
    stages the target folder, its parent folder, and the `package.json` path
    inside the target, at `serve-edit-paths.ts:105` to line 115.
  - When the pass succeeds, it adds the staged files to `paths.lookupFiles`,
    at line 138.
  - `resolutionInputs` writes each lookup file into the metadata inputs,
    with its digest or null, at `resolution-inputs.ts:64` to line 68.
  - The core keeps only the present files as `resolution_digests`, at
    `crates/mokly-render/src/render_environment.rs:110`. The field comment at
    line 23 says "Present resolution files by logical name".
  - `build_modules`, at `crates/mokly-graph/src/render_inputs.rs:139` to line
    155, puts each present resolution file on no module chain into the shared
    key digest. Runtime manifests and Storybook previews stay out.
  - A `full` compile creates no `ServeEditImports`, so its lookup files stay
    empty. Its metadata inputs hold only the `package.json` and
    `tsconfig.json` candidates of each consumed module's chain, at
    `resolution-inputs.ts:69` to line 75.
  - A `full` compile records the earlier candidates in its reuse evidence.
    That evidence moves no render input key.
  - The concrete prerequisite comes from reading the code:
    - A `tsconfig.json` maps `"@app/*": ["./a/*", "./b/*"]`, and a catalogue
      module imports `@app/x`.
    - `a/x/` is a folder with a `package.json`, but esbuild selects no file
      there. It has no index file, and its manifest names no existing entry
      file.
    - esbuild then selects the later target, such as `b/x.ts`.
    - No module that the bundle consumes lives in `a/x/`.
  - With that prerequisite, a marked compile adds `a/x/package.json` with its
    digest to the metadata inputs. A `full` compile of the same source does
    not.
  - No run has reproduced this. The facts above come from reading `main` at
    `f4f0082fd`.
  - On 2026-11-19 the performance orchestrator chose a private table for
    package folder mappings. A marked compile keeps those file observations
    in its `reuseEvidence.inputs`, as file, absent, or link entries. The
    reason was that a render-key change alters published identities and
    Changes.
  - `docs/protocol/mokly-sidecar-folder-reuse.md` holds that rule. It covers
    only imports that a package folder mapping selects, not `paths`
    mappings.
- **Problem:** For equal source, a marked compile can put a present
  earlier-candidate manifest into the shared key digest, while a `full`
  compile leaves it out. The render input keys of the head side then depend
  on the capture mode, not only on the inputs.
- **Impact if no action:** In a catalogue with such a mapping, each view of
  the Serve head can get another render input key after the switch to the
  marked mode, with equal content. The identities and the Changes that depend
  on these keys can then differ from those of a `full` compile of the same
  source.
- **Root question:** How does a marked compile observe the manifests of
  earlier `paths` candidates without giving render input keys that differ
  from a `full` compile of the same source?
- **Options:**
  - **A.** Change nothing. The keys keep their mode difference in this rare
    setup. Effort: Small.
  - **B.** Keep the earlier `paths` candidate manifests of a marked compile
    in its private reuse-evidence table, as file, absent, or link entries.
    The sidecar and the binary check them as they check the folder-map files.
    The live directory lists stay. This extends the private-table rule of
    `docs/protocol/mokly-sidecar-folder-reuse.md` to `paths` mappings, which
    is a protocol change. Effort: Medium.
  - **C.** Add the same candidate manifests to the metadata inputs of `full`
    compiles too, so both modes give equal keys. It changes the public render
    keys of `main` for such catalogues, against the 2026-11-19 decision.
    Effort: Medium.
  - **D.** Withhold the marker when an earlier `paths` candidate holds a
    present manifest. Such imports then lose marked edit reuse. Effort:
    Small.
- **Left out:**
  - Leave these manifests out of the marked checks. A manifest that appears
    with an entry field can change the selection, so marked reuse could keep
    a stale module. It fails the goal.
  - Filter marked-only files out of the render keys in the core. It needs a
    new mark in the metadata inputs or a new field. It also excludes a
    public key field silently, which the 2026-11-19 decision rules out.
- **Wider fix:** B. One private table for each marked-only file observation
  keeps the public render inputs equal by placement, so a new marked check
  cannot move keys again.
- **Previous examples:** The package folder evidence change first staged its
  folder-map files in the metadata inputs of both modes. On 2026-11-19 it
  discarded that draft and moved the files into the private table, for this
  same reason.
- **Related:**
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): the same
    boundary. Both items decide which resolution files enter the metadata
    inputs that watch Serve and key renders. That item adds configuration
    files to them in both modes. This item takes marked-only candidate
    manifests out. Each item can merge alone.
  - [marked-package-entry-targets.md](./marked-package-entry-targets.md):
    the same marked live-input code. Its options add observations for the
    entry targets of directory packages. A file observation that such a fix
    adds only in the marked mode must use the private table, or it repeats
    this problem. Each item can merge alone.
- **Recommendation:** B. It keeps the public render inputs of both modes
  equal and keeps marked edit reuse, through the private table and matchers
  that the package folder change added.
- **Action:** ask the user, because B extends the private-table rule to
  `paths` mappings, and the 2026-11-19 decision authorized it only for
  package folder mappings.
