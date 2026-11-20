# Marked reuse misses earlier package entry targets

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from round 2 of the implementation review of the
  branch `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, at commit
  `46c40bade` against `main` at `4614c4a90`. The finding check of the same
  round added the index-fallback form.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts:19` and line
  52 to line 63, `packages/mokly/src/sidecar/resolution-evidence.ts:148` to
  line 151 and line 204, and `packages/mokly/src/sidecar/config-inputs.ts:47`
  to line 56.
- **Reason:** The limit predates the absolute paths fix and also occurs
  without its mapped-import pass, so a fix needs its own decision on the
  marked live checks.

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
  - **Directory package:** a local folder with its own `package.json` that an
    import names as a folder, such as `./mapped`. esbuild selects its module
    through the entry fields of the manifest, or through the folder's index
    file.
  - **Entry fields:** the manifest fields that `moduleResolution.mainFields`
    lists. In the probe, `mainFields` was `["module", "main"]` with string
    values, and esbuild took the `main` file while the `module` file was
    absent. In a second probe, `main` named an absent file, and esbuild took
    the folder's `index.js`. No probe covers browser conditions or object
    forms of these fields.
  - **Captured evidence:** the reuse evidence of a compile in the `full`
    mode. Captured reuse, released recipes, the bundle cache, and Serve plans
    check it.
- **Background:**
  - Section "Reuse And Identity" of `docs/protocol/mokly-sidecar-recipes.md`
    gives the live checks. A marked compile has only these checks.
  - `resolutionInputs`, at `packages/mokly/src/sidecar/resolution-inputs.ts:52`
    to line 63, records the folder of each consumed module, and the
    `package.json` and `tsconfig.json` candidates of its ancestor folders up
    to its root. The same loop is on `main`.
  - For a directory package, the consumed module lies in the folder of the
    selected entry target. The loop then holds that folder, and the manifest
    as an ancestor candidate. It holds no other folder of an earlier entry
    target whose file was absent.
  - A Mokly probe of 2026-11-18 showed the limit:
    - The fixture had a root `package.json`, a `tsconfig.json` that mapped
      the key `fixture` to `./mapped`, and `mapped/package.json` with
      `module` set to `./one/value.js` and `main` set to `./two/value.js`. It
      had `mapped/one/.keep` and `mapped/two/value.js` with the value `two`.
      `mainFields` was `["module", "main"]`.
    - In one form the entry imported `fixture`. In the other form, the
      relative control, it imported `./mapped`.
    - In both forms the first `serveEdit` compile selected `two` and carried
      the marker, and a reuse before any change succeeded. At the reviewed
      commit, its live directory lists held only the source root and
      `mapped/two`.
    - The probe then wrote `mapped/one/value.js` with the value `one`. A
      fresh compile selected `one`, but marked reuse kept `two`, in both
      forms.
  - The finding check of the same review round found the index-fallback
    form:
    - `fixture` mapped only to `./mapped`. `mapped/package.json` set `main`
      to the absent `./dist/index.js`, and `mapped/index.js` had the value
      `index`.
    - The first `serveEdit` compile selected `index` and carried the marker,
      and a reuse before any change succeeded. Its live directory lists held
      only the source root and `mapped`.
    - After `mapped/dist/index.js` appeared with the value `dist`, a fresh
      compile selected it, but marked reuse kept `index`.
  - The check also modelled each option of a separate fix of the same
    branch, for overlapping `paths` targets. The applied fix, at
    `packages/mokly/src/sidecar/mapped-selection.ts:43` to line 49 and
    `packages/mokly/src/sidecar/serve-edit-paths.ts:110` and line 120, takes
    an `index` file directly inside a mapped folder target as proof of that
    target. When the target contains the module in another way, the pass
    adds that folder and its `package.json` to the live checks, goes on with
    the later candidates, and keeps the marker. So a compilation that selects
    through a mapped package folder keeps its marker.
    - In the index-fallback form, each model and the reviewed commit gave the
      same live directory lists and the same result.
    - In the mapped form of the first probe, the model of the applied fix
      also listed `mapped` and kept the marker. Marked reuse still kept
      `two`, because `mapped/one` existed before the change, and the lists
      hold only the names of files and links.
    - By code reading, the final code of that fix gives the same lists in
      both forms.
  - The relative control never enters the mapped-import pass of the absolute
    paths fix, and `resolutionInputs` has the same relevant code on `main`.
    So the limit predates that fix and does not come from it.
  - By code reading only, the captured evidence may share the gap. For a
    relative or mapped folder candidate, `ResolutionEvidence` records the
    folder and its parent, at
    `packages/mokly/src/sidecar/resolution-evidence.ts:148` to line 151.
    `targets`, at line 204, records the file of each entry field, but it runs
    only for the package lookup of a bare import. `ConfigInputs.manifest`, at
    `packages/mokly/src/sidecar/config-inputs.ts:47` to line 56, records the
    manifest file and not its entry targets. A recorded folder lists its
    entries, so a new file inside the existing `mapped/one` folder changes
    no recorded entry. The index-fallback form differs: `mapped/dist` is a
    new folder, so the recorded `mapped` folder gains an entry, and captured
    evidence would likely see it. `directoryFiles`, at
    `packages/mokly/src/sidecar/resolution-inputs.ts:19`, keeps only the
    names of files and links, so the live lists miss that new folder. No
    probe has checked the captured owners.
  - The performance orchestrator owns each change to the marked live-check
    rule, under the user's delegation of 2026-11-16. This limit stays outside
    the scope of the absolute paths fix, because the relative import never
    enters its new mapped-import pass and the relevant `resolutionInputs`
    loop is unchanged from `main`.
- **Problem:** The live checks of a marked compile list the folder of the
  selected entry target of a directory package, but not the other folder of
  an earlier entry target. Examples are `mapped/one` for a `module` file
  before the `main` file in `mapped/two`, and the absent `mapped/dist` for a
  `main` file before the index file. In the probed forms, when that earlier
  entry file appears during a live session, a fresh compile selects it, but
  marked reuse keeps the later one.
- **Impact if no action:** Rarely, Serve keeps an old module after an earlier
  entry file of a local directory package appears in another folder, such as
  a new `module` build in a folder beside the `main` build, or a new `main`
  build folder beside an index file. It keeps it until a JavaScript edit
  changes a consumed file, or until a restart. If the captured owners share
  the gap, a captured compilation and the bundle cache can keep it across
  restarts too.
- **Root question:** How can reuse observe the entry targets of a directory
  package that esbuild tries before its selection?
- **Options:**
  - **A.** Change nothing. Marked reuse keeps the limit of `main`. Effort:
    Small.
  - **B.** Record the entry targets of a folder candidate in the captured
    evidence too, as `targets` does for package lookups. It applies if a
    probe confirms the captured gap, and it leaves marked reuse unchanged.
    Effort: Small.
  - **C.** Withhold the marker when an import selects through a directory
    package manifest with an earlier entry field. It removes marked reuse
    for such packages. Effort: Small.
  - **D.** After a compile, read the manifest of each directory package that
    an import selected, and add the folder of each earlier entry target to
    the live directory lists, as the probed orders need: `module` before
    `main`, and `main` before the index file. Browser conditions and object
    forms need their own probe first. It uses the existing list format, which
    lists an absent folder as empty, so a new `mapped/dist` with an entry file
    also ends the reuse. Effort: Medium.
  - **E.** Describe the candidates of a folder lookup once, with its index
    files and its entry fields, and use that description in the captured
    evidence, the live checks, and the mapped-import pass. Effort: Large.
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
  - The captured evidence covers what the live checks miss. Source: earlier
    limits of marked reuse, such as link retargets. It is unconfirmed for
    entry targets. B and E drop it.
- **Wider fix:** E. One description of folder candidates keeps the captured
  evidence, the live checks, and the mapped-import pass in step.
- **Previous examples:**
  `plans/follow-ups/marked-reuse-link-retarget.md` and
  `plans/follow-ups/jsconfig-resolution-input.md` record other observations
  that the live checks of a marked compile miss. The absolute paths fix of
  2026-11-18 added mapped target folders and their `package.json`
  candidates to the live checks.
- **Related:**
  - [marked-reuse-link-retarget.md](./marked-reuse-link-retarget.md): another
    missing live observation. A shared observation model can serve both
    items.
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it asks how in-process reuse proves that its evidence describes the view
    from which esbuild selected each module, and it keeps the marked
    exception. This item concerns an observation that no check makes, not a
    timing window. Each item can merge alone.
- **Recommendation:** D. It observes the earlier entry folders with the
  existing list format and keeps marked reuse for directory packages. First,
  a probe of the captured owners decides whether B joins it. E best protects
  the codebase.
- **Action:** ask the user, because C and D change the marked live-check rule
  of `docs/protocol/mokly-sidecar-recipes.md`, which the performance
  orchestrator owns, and no probe has settled the captured side.
