# Include jsconfig paths in resolution inputs

- **Severity:** Medium (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts:57`,
  `crates/mokly-graph/src/render_closure.rs:6`,
  `docs/protocol/mokly-sidecar-modules.md:142`, and
  `docs/protocol/mokly-watch.md:70`.
- **Reason:** The exhaustive watch-input rule omits this file, so the user
  must choose whether that requirement changes.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Compilation reuse:** the sidecar keeps a compiled bundle while its
    recorded inputs stay unchanged, so that an unrelated edit does not
    compile again.
  - **Render input key:** the key of one entry module's renders. It moves
    when one of its inputs changes, under the watch contract.
- **Background:**
  - esbuild reads `paths` from a `jsconfig.json`, as it does from a
    `tsconfig.json`. `packages/mokly/src/sidecar/package-scope.ts:107`
    already reads `tsconfig.json`, else `jsconfig.json`, for parse
    settings.
  - `resolutionInputs` in
    `packages/mokly/src/sidecar/resolution-inputs.ts:57` records the
    `package.json` and `tsconfig.json` candidates of each consumed module's
    directory chain as compilation inputs. It records no `jsconfig.json`.
  - `docs/protocol/mokly-sidecar-modules.md:142` lists the same two
    candidates as reuse inputs.
  - In Rust, `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:6` lists the same two names
    for the render input keys. `docs/protocol/mokly-watch.md:70` states that
    rule.
  - `mokly-watch.md:57-59` makes that input list exhaustive with "and only
    then". Adding `jsconfig.json` changes that explicit requirement.
  - Two general rules apply. `mokly-sidecar-modules.md:142` says that a
    compilation is reused only while its inputs stay unchanged.
    `docs/protocol/mokly-runtime.md:44` says that a watched change renders
    again the outputs whose inputs changed.
- **Problem:** An edit to the `paths` of a `jsconfig.json` changes how
  esbuild resolves imports, but it is not a compilation input. The sidecar
  can then reuse a compilation that resolves an alias to the old file. It is
  not a render input either, so an edit of its parse options leaves the
  render input keys unchanged.
- **Impact if no action:** A JavaScript catalogue that uses `jsconfig.json`
  aliases can show modules from the old alias target until another input
  changes or Serve restarts. An edit of its parse options can leave stale
  renders, also after A.
- **Root question:** How does every file that esbuild reads for resolution
  invalidate compilation and rendered output?
- **Options:**
  - **A.** Add `jsconfig.json` to the candidate names in
    `packages/mokly/src/sidecar/resolution-inputs.ts:57`, so that an edit
    invalidates compilation reuse and enters the watch inputs. Update the
    list in `docs/protocol/mokly-sidecar-modules.md:142`. It leaves the
    render input keys unchanged for an edit of the parse options.
    Effort: Small.
  - **B.** Apply A. Also add `jsconfig.json` to `RESOLUTION_FILES` in
    `crates/mokly-graph/src/render_closure.rs:6`, so that an edit moves the
    render input keys as a `tsconfig.json` edit does. Update
    `docs/protocol/mokly-watch.md:70`. B changes one name list in each of two
    code files, about two lines, and adds no code or test file. It changes
    no message between the core and the sidecar, so it fits the Small band
    across the two packages. It also changes the exhaustive watch-input
    requirement, which needs the user's choice. Effort: Small (estimate).
  - **C.** Let the sidecar report the resolution file names that it records
    in each bundle result, and make the Rust chain use the reported names.
    One list then serves both sides. Effort: Large (estimate).
- **Left out:** Change nothing. A stale compilation breaks the reuse rule
  that a compilation stays only while its inputs stay unchanged.
- **Wider fix:** C (estimate). One reported list keeps the sidecar inputs
  and the render input keys equal.
- **Previous examples:** None found.
- **Recommendation:** B. (estimate) It makes both caches react to bytes that
  already shape the output, with one list entry on each side.
  The record first recommended A, while it graded B Large. C best protects
  the codebase.
- **Action:** ask the user, because condition 1 holds (estimate): B changes
  the explicit watch-input requirement. The general reuse and runtime rules
  do not authorize overriding that exhaustive list without a recorded choice.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L421).
