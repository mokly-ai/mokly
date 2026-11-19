# Reuse evidence omits ancestor Plug'n'Play manifests

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the options check of the exact Serve plan
  change on branch `calummoore/mokly-plan-reuse-editor-files-6dni`, which
  listed this gap outside the plan, and from a read-only source check of the
  gap on the same date. The check read the source at `be242a628` and
  esbuild 0.28.2, and it ran nothing.
- **Location:** `packages/mokly/src/sidecar/bundle.ts:214` to line 217,
  `packages/mokly/src/sidecar/config-inputs.ts:47` to line 115,
  `packages/mokly/src/sidecar/resolution-inputs.ts:49` to line 83,
  `packages/mokly/src/sidecar/physical-inputs.ts:211` to line 234, and the
  section "Reuse And Identity" of `docs/protocol/mokly-sidecar-recipes.md`.
- **Reason:** The gap predates the exact Serve plan change, which keeps the
  current comparisons of recorded inputs, and nobody has reproduced a
  changed output.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory listing, absent
    path, and link that can change how an import of a compiled bundle
    resolves. Each reuse check compares it with the filesystem.
  - **Plug'n'Play manifest:** a Yarn file, `.pnp.data.json`, `.pnp.cjs`, or
    `.pnp.js`, that maps package imports to their files without
    `node_modules` folders.
  - **Working directory:** the directory that esbuild starts from. The
    sidecar sets it to the configuration directory under the source root.
- **Background:**
  - The sidecar sets the esbuild working directory at
    `packages/mokly/src/sidecar/bundle.ts:214` to line 217. It joins the
    source root and the configuration directory.
  - esbuild 0.28.2 looks for one manifest at the first resolve of each
    build. The source is `internal/resolver/resolver.go` at the esbuild tag
    `v0.28.2`:
    - Line 515 to line 530 walk from the working directory through each
      parent directory. The first directory with a manifest wins, and
      esbuild parses that manifest.
    - Line 1693 to line 1700 check the entries of each directory for
      `.pnp.data.json`, then `.pnp.cjs`, then `.pnp.js`, each as a file.
    - Line 2402 to line 2455 resolve package imports through an active
      manifest, and report its errors.
  - The capture records no manifest name:
    - `manifest` at `packages/mokly/src/sidecar/config-inputs.ts:47` records
      `package.json` candidates. `configuration` at line 65 and
      `candidateInputs` at line 100 record `tsconfig.json` and `jsconfig.json`
      candidates.
    - `pathLinks` at `packages/mokly/src/sidecar/physical-inputs.ts:211` to
      line 234 walks the parent paths for link and durability observations.
      It saves no listing of each parent.
    - `resolutionInputs` at
      `packages/mokly/src/sidecar/resolution-inputs.ts:49` to line 83 saves
      the listings of consumed-module directories and lookup directories. On
      the ancestor chains it records only `package.json` and
      `tsconfig.json`.
  - The rule in force, in the section "Reuse And Identity" of
    `docs/protocol/mokly-sidecar-recipes.md`: the reuse evidence records each
    file and directory that can change how a bundled import or a peer resolves.
    Its list names the package, tsconfig, and jsconfig candidates, and no
    manifest.
  - The condition: an ancestor directory that esbuild searches has no
    recorded listing, and no other recorded input observes the manifest
    change. A manifest that appears there later has no recorded absence. A
    fresh compile can then read a manifest that the old evidence does not
    name.
  - Reuse checks run in the sidecar, in the core, and for stored bundle
    cache entries. So a missed manifest can also reach a later process.
  - Limits of the evidence:
    - Nobody reproduced a stale output, a wrong module, or a hidden error.
    - The manifest must change an actual resolution or a compiler
      diagnostic. That is not shown for any Mokly catalogue.
    - Another directory listing, consumed file, toolchain check, or failed
      capture can still reject the reuse.
    - A manifest in a recorded directory is not this case, because the
      listing of that directory changes.
    - So not every new manifest defeats the current checks.
  - The base installer rejects Yarn Plug'n'Play on purpose. A Berry
    Plug'n'Play linker uses tier three, with the typed reason
    `Yarn Plug'n'Play is unsupported`, in
    `docs/protocol/mokly-base-dependencies.md`. This item does not ask for
    Plug'n'Play base installs. It concerns the manifest reads of esbuild in
    head and direct sidecar compiles, also a possible error difference.
  - The exact Serve plan change keeps the manifest names as candidate names
    of each recorded directory, in the section "Candidate Names" of
    `docs/protocol/mokly-sidecar-plans.md`. It adds no observation for an
    ancestor without a listing. So its plan check has the same gap.
- **Problem:** The reuse evidence holds no observation of a Plug'n'Play
  manifest in an unrecorded ancestor of the esbuild working directory. A
  manifest that appears there after the capture cannot reject reuse.
- **Impact if no action:** Rarely, Serve, a build, or a later process could
  reuse a compilation that a fresh compile would resolve or report in
  another way. Nobody has shown such a case.
- **Root question:** How does the reuse evidence observe each Plug'n'Play
  manifest that esbuild can select for a compile?
- **Options:**
  - **A.** Change nothing. The gap stays. Effort: Small.
  - **B.** Reproduce first. Change an ancestor manifest after a stable
    capture, and compare the reused result with a fresh compile. Record
    which inputs stay equal. Then record the three manifest names in each
    directory that esbuild searches, from the working directory up to the
    first manifest or the filesystem root. Cover presence, priority,
    content, kind, and links only as the reproduction needs. Add the
    manifests to the evidence list of
    `docs/protocol/mokly-sidecar-recipes.md`. Effort: Medium.
  - **C.** Record the whole listing of each ancestor of the working
    directory. It is exact. Any change in an ancestor, such as the home
    directory, then rejects reuse. It reduces the reuse of `main`, so it
    needs the user. Effort: Medium.
- **Left out:** Evidence that becomes incomplete when esbuild loads a
  manifest. It fails the goal, because the risk is a manifest that is absent
  at the capture.
- **Wider fix:** None. The class is each esbuild read that the capture does
  not model. Only a trace of the reads of esbuild would prevent it, and the
  esbuild API gives no such trace.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/case-collision-unlisted-directory.md` and
    `plans/follow-ups/link-target-kind-evidence.md`, the same code: the
    reuse evidence capture and its checks. Each item has its own cause, so
    one branch can take them together.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code.
    It owns changes during a compile. This item owns a change after a
    completed capture.
- **Recommendation:** B. It keeps the reuse of `main`, and the reproduction
  decides which manifest facts the evidence needs.
- **Action:** fix after merge, apply B, because the gap predates the exact
  Serve plan change, nobody reproduced a changed output, and the
  reproduction decides the exact observation.
