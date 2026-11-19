# Watch and key jsconfig and extends target files

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review. On 2026-11-16 the options check of
  identity call 22 of the bundle disk cache change added the `extends`
  target case. On 2026-11-18 the options check of the follow-up items of the
  absolute paths reuse evidence plan, on branch
  `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, added the marked Serve
  edit case.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts:64` to line
  75, `packages/mokly/src/sidecar/config-inputs.ts:145` to line 150,
  `crates/mokly-graph/src/render_closure.rs:10`,
  `crates/mokly-graph/src/render_inputs.rs:140` to line 148, and
  `docs/protocol/mokly-watch.md:70`.
- **Reason:** The exhaustive watch-input and render-key rule omits these
  files, so the user must choose whether that requirement changes.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Metadata inputs:** the resolution files that the sidecar records in the
    `metadataInputs` field of a compiled recipe. The core watches them and
    keys renders with them.
  - **Reuse evidence:** the cache-only `reuseEvidence` field of a compiled
    recipe. Only the reuse checks of the sidecar and the core read it.
  - **Render input key:** the key of one entry module's renders. It moves
    when one of its inputs changes, under the watch contract.
  - **Module chain:** the `package.json` and `tsconfig.json` candidates in a
    module's directory and its parents, up to its source or dependency root.
  - **Extends target:** a file that the `extends` field of a `tsconfig.json`
    or `jsconfig.json` names, such as `./tsconfig.base.json`.
- **Background:**
  - esbuild reads `paths` and `baseUrl` from a `jsconfig.json` when its
    directory has no `tsconfig.json`, as it does from a `tsconfig.json`. It
    also reads each extends target of that configuration.
  - `packages/mokly/src/sidecar/package-scope.ts:107` reads the nearest
    `tsconfig.json`, else `jsconfig.json`. `parseSettings`, at line 59,
    treats parse options in that file, such as `jsx` or
    `experimentalDecorators`, as settings that change how esbuild parses a
    module. So an edit of those options, also through an extends target, can
    change compiled code while the module bytes and imports stay the same.
  - On 2026-11-16 the bundle disk cache change fixed the compilation reuse
    half of this item:
    - `ConfigInputs` in `packages/mokly/src/sidecar/config-inputs.ts`
      records each `jsconfig.json` candidate beside each `tsconfig.json`
      candidate, also above the source root, in the reuse evidence. See
      `configuration` at line 65 and `candidateInputs` at line 100.
    - `readConfig`, at lines 145 to 150 of the same file, records each
      relative extends target, with or without its `.json` suffix, in the
      reuse evidence.
    - The sidecar's `reuse` in `packages/mokly/src/sidecar/compiled.ts:106`
      and the core's in-process reuse at
      `crates/mokly-render/src/bundle.rs:63` reject an earlier compilation
      when that evidence changed.
    - The content of each present `jsconfig.json` and extends target also
      enters the compilation identity, at
      `packages/mokly/src/sidecar/bundle-recipe.ts:148`. So the next bundle
      after an edit gives a new generation id.
    - `docs/protocol/mokly-sidecar-recipes.md` states these rules.
  - The reuse evidence never enters the metadata inputs. So it reaches no
    watch input and no render input key:
    - `derive` builds the resolution digests of the render input keys from
      the metadata inputs only, at
      `crates/mokly-render/src/render_environment.rs:110`.
    - `stamp`, at `crates/mokly-render/src/bundle_attempt.rs:82` to line 109,
      builds the input stamp from the metadata inputs and the module digests.
      The stamp gives the `resolution_files` that the watcher observes, at
      `crates/mokly-render/src/bundle.rs:199` and
      `crates/mokly-cli/src/serve_watch_plan.rs:95`.
    - The section "Watch Targets And Readiness" of
      `docs/protocol/mokly-watch.md` says that this evidence is not a watch
      input and moves no render input key.
  - `resolutionInputs` in
    `packages/mokly/src/sidecar/resolution-inputs.ts:70` records the
    `package.json` and `tsconfig.json` candidates of each consumed module's
    directory chain as metadata inputs. It records no `jsconfig.json` and no
    extends target by itself.
  - An extends target is a metadata input only when it is also a
    `tsconfig.json` candidate of a chain directory. In this repository each
    package extends the root `tsconfig.json`, so its edits already rebuild. A
    target such as `./tsconfig.base.json`, or a `tsconfig.json` in a
    directory on no module chain, is not a metadata input.
  - Since 2026-11-18, a marked Serve edit compile records no reuse evidence.
    A later `serveEdit` request of the same process reuses it while its live
    inputs stay unchanged: the consumed file digests, the metadata inputs,
    and the directory lists. `resolutionInputs`, at
    `packages/mokly/src/sidecar/resolution-inputs.ts:64` to line 75, gives
    those inputs. So they hold no `jsconfig.json` and no extends target that
    is not a module chain candidate.
  - A Mokly probe of 2026-11-18 showed the result. `tsconfig.base.json`
    mapped `@/*` to `./one/*`, and `tsconfig.json` only extended
    `./tsconfig.base.json`. The entry imported `@/value`, and both
    `one/value.js` and `two/value.js` existed. The first `serveEdit` compile
    selected `one` and carried the marker. After the base mapped `@/*` to
    `./two/*`, a fresh compile selected `two`, but marked reuse kept `one`.
  - Captured reuse differs. The same probe with `capture: "full"` selected
    `one` with complete evidence. After the base edit, its reuse check
    declined, because its evidence records the extends target, so the next
    bundle compiled again.
  - The metadata inputs are also live inputs of every compile. But a marked
    compile reads configuration chains only in `ServeEditPaths` and
    `ServeEditImports`, for the folders of its authored imports, and it keeps
    none of the configuration files that it reads there as live inputs. So a
    fix of this item must also give a marked compile the base files of each
    chain as live inputs. A `jsconfig.json` candidate that A or B adds to
    `resolutionInputs` reaches marked compiles without more work.
  - In Rust, `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:10` lists `package.json` and
    `tsconfig.json`. `chain`, at line 158, lists them in a module's
    directory and its parents.
  - `RenderInputs::build`, through `build_modules` at
    `crates/mokly-graph/src/render_inputs.rs:140` to line 148, splits the
    present resolution files:
    - A file on a module chain enters only the keys whose closures hold that
      module.
    - A file on no module chain enters the shared part of every key of its
      side, unless it is a runtime manifest or a Storybook preview.
  - This item first said that option A leaves the render input keys
    unchanged. The split above shows the opposite: A puts a present
    `jsconfig.json` into the shared part, so each edit moves every key of
    its side.
  - Render input keys never contain a generation id, under the "Bundling"
    section of `docs/protocol/mokly-sidecar.md`. So after the new id, a
    per-module view whose key did not move can still serve the render of the
    old code. Only the whole-bundle fallback key contains the id.
  - `docs/protocol/mokly-watch.md:57` to line 59 makes the render-key input
    list exhaustive with "and only then". `mokly-watch.md:70` names the
    `package.json` and `tsconfig.json` candidates.
  - `docs/protocol/mokly-runtime.md:46` says that a watched change renders
    again the outputs whose inputs changed.
- **Problem:** An edit of a `jsconfig.json`, or of an extends target that is
  not a module chain candidate, is not a watch input, so watched Serve does
  not rebuild for it. It is not a render input either. Its keys move only when
  the next compile changes the module graph or the module bytes, so a
  parse-option edit can leave stale renders. A `tsconfig.json` edit on a
  module chain rebuilds and moves the keys of the closures on that chain. In
  watched Serve, a marked edit compile also keeps the old module after an
  edit of such a file, because its live inputs do not hold the file.
- **Impact if no action:** A JavaScript catalogue that uses `jsconfig.json`
  aliases, or a `tsconfig.base.json`, keeps the old resolution in watched
  Serve until another watched change, a manual rebuild, or a restart. A
  captured compile then compiles again at the next bundle, because its reuse
  evidence changed. A marked Serve edit compile keeps the old module until a
  JavaScript edit changes a consumed file, or until a restart. By code
  reading, a manual rebuild keeps it too, because it uses the same live
  checks. A parse-option edit can leave cached renders from the old code
  until their keys move.
- **Root question:** How does a watched edit of a configuration file that
  esbuild reads, such as a `jsconfig.json` or an extends target, rebuild the
  catalogue from current code and move the affected render input keys, as a
  `tsconfig.json` edit does?
- **Options:**
  - **A.** Record both kinds as metadata inputs. Add `jsconfig.json` to the
    candidate names in `packages/mokly/src/sidecar/resolution-inputs.ts:70`,
    and add each extends target that `ConfigInputs` records. Each file then
    enters the input stamp and the watch inputs. No module chain names these
    files, so each edit moves every key of its side. A target without a
    logical name, outside the source root and the dependency roots, stays
    reuse evidence only. Update `docs/protocol/mokly-watch.md:70`. Effort:
    Medium.
  - **B.** Apply A. Also add `jsconfig.json` to `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:10`, so that a `jsconfig.json`
    edit moves only the keys whose closures hold a module on its chain, as a
    `tsconfig.json` edit does. An extends target edit still moves every key
    of its side, because target names vary. It changes no message between
    the core and the sidecar. Effort: Medium.
  - **C.** Let the sidecar report, for each chain directory, the
    configuration files that it reads there, including `jsconfig.json` and
    each extends target, and make the Rust chain use the reported files.
    Each edit then moves only the keys of the closures that read the file.
    One list then serves both sides. Effort: Large.
  - **D.** Change nothing. Both kinds stay reuse evidence and identity inputs
    only, and the exhaustive requirement stays. An edit takes effect at the
    next bundle of a captured compile. A marked Serve edit compile keeps the
    old module until a JavaScript edit changes a consumed file, or until a
    restart. A view whose key did not move can keep its old render. Effort:
    Small.
- **Left out:**
  - Put the whole reuse evidence into the metadata inputs. Its directory
    lists, absent candidates, and peer manifests would then move render
    input keys and start rebuilds for unrelated files. A and B add only the
    configuration files that esbuild reads.
  - Add each extends target name to `RESOLUTION_FILES`. Target names differ
    in each project, so a fixed list cannot hold them. C reports them.
- **Wider fix:** C. One reported list keeps the sidecar inputs and the render
  input keys equal.
- **Previous examples:** None found.
- **Related:**
  - [package-tsconfig-extends-reuse.md](./package-tsconfig-extends-reuse.md):
    it adds package-name and absolute extends targets to the reuse evidence.
    Such a target then has the watch and render-key gap of this item. That
    item gives the package base files to marked compiles, and this item gives
    the relative ones. Each item can merge alone.
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it keeps the marked Serve edit exception of 2026-11-18, whose live checks
    prove no fresh selection. The marked gap of this item is a missing live
    input, not a window of that item. Each item can merge alone.
- **Recommendation:** B. It watches every configuration file that esbuild
  reads, and it moves at least the affected keys. A `jsconfig.json` edit
  moves only its closures' keys. A rare extends target edit moves every key
  of its side. D keeps the watch gap. The record first recommended A, while
  it graded B Large. C best protects the codebase.
- **Action:** ask the user, because A, B, and C change the explicit
  watch-input and render-key requirement of `docs/protocol/mokly-watch.md`.
  The general reuse and runtime rules do not authorize overriding that
  exhaustive list without a recorded choice.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L421).
