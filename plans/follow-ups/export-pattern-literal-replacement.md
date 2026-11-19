# Export pattern evidence misreads target paths

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the final options check of design items 3 and 4
  of the absolute paths reuse evidence plan on branch
  `calummoore/mokly-absolute-paths-evidence-fix-zqzl`. Extended on the same
  day from the options check of this item, with the exact-key symptom.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts:245` and
  `packages/mokly/src/sidecar/path-pattern.ts:10`.
- **Reason:** The absolute paths fix does not change the package exports step
  of the reuse evidence, and the probes show no changed reuse result.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reuse evidence:** the record of each file and directory that can change
    how a compiled bundle resolves. A later bundle reuses a compilation only
    while this evidence still matches the filesystem.
  - **Export pattern:** a key with one `*` in the `exports` field of a package
    manifest, such as `"./*": "./dist/*.js"`. esbuild puts the text that the
    `*` of the key matched into each `*` of the target, as written.
  - **Exact key:** an `exports` key without `*`, such as `"./x"`. esbuild uses
    its target as written, also a literal `*` in it.
  - **Replacement pattern:** a `$` sequence, such as `$&` or `$$`, that
    JavaScript's `replace` and `replaceAll` read in a string replacement. A
    function replacement inserts its result as written.
- **Background:**
  - `ResolutionEvidence.exports` in
    `packages/mokly/src/sidecar/resolution-evidence.ts` records the candidate
    of each export target that matches the requested subpath, before esbuild
    resolves the import.
  - At line 245 it builds the candidate with
    `value.replaceAll("*", matched ?? "")`. `matched` is the text of the
    requested subpath that the `*` of the key matched. For an exact key,
    `substitution` in `packages/mokly/src/sidecar/path-pattern.ts:10` gives an
    empty match, so line 245 removes each `*` of the target.
  - A native esbuild 0.28.2 probe of 2026-11-18 compared the selected file
    with the candidate of line 240:
    - Exact key `"./x": "./dist/a*b.js"`: esbuild selects `dist/a*b.js`. Line
      240 records `./dist/ab.js`.
    - Subpath `c$&d` under `"./*": "./dist/*.js"`: esbuild selects
      `dist/c$&d.js`. Line 240 records `./dist/c*d.js`.
    - Subpath ``e$`f``: esbuild selects ``dist/e$`f.js``. Line 240 records
      `./dist/e./dist/f.js`, in another folder.
    - Pattern `"./m/*": "./multi/*/*.js"` with subpath `m/q`: esbuild fills
      every `*` and selects `multi/q/q.js`. Line 240 records the same path.
  - A Node check of the same day also gave `./dist/a$b.js` for the subpath
    `a$$b`. A function replacement, `() => matched`, gave each text as
    written.
  - An export target array does not fall back on a missing file. With the
    targets `./a/*.js` and then `./b/*.js`, and only `b/x.js` present,
    esbuild fails with "Could not resolve". With an invalid first target,
    `a/*.js`, esbuild selects `b/x.js`.
  - A missing export target fails the Mokly bundle with `bundle-failed`, also
    inside `try` and `catch`, for each probed subpath. Plain esbuild keeps
    such an import as an external edge. A present target is a consumed
    input, so its digest and its folder are checked. So the probes show no
    stale output. The defect concerns the accuracy of the evidence.
  - On `main`, the `paths` step used `target.replace("*", matched)` for every
    key, so it had both defects. The absolute paths fix moved that step to
    `mappedPaths` in `packages/mokly/src/sidecar/mapped-paths.ts:39`. It keeps
    the target of an exact key as written and inserts the matched text with
    a function replacement.
  - A shared helper must keep two rules. An export target fills every `*`. A
    `paths` target fills its first `*`. The reader rejects a `paths` target
    with two stars, so one rule gives the same result there today.
- **Problem:** For an exact key with a literal `*` in its target, and for a
  subpath that holds a `$` replacement pattern, the exports step records
  another path than the target that esbuild resolves.
- **Impact if no action:** The reuse evidence holds an export candidate that
  esbuild does not check. The probes show no changed reuse result, because a
  missing target fails the bundle and a present target is a consumed input.
  Such keys and subpaths are rare.
- **Root question:** How does the exports step of the reuse evidence record
  the target path that esbuild resolves for a requested subpath?
- **Options:**
  - **A.** Change nothing. The evidence keeps both misreads. Effort: Small.
  - **B.** Use a function replacement at line 245,
    `value.replaceAll("*", () => matched ?? "")`, as the `paths` step does.
    Add one regression test: a subpath with `$&` under an export pattern
    records the literal target path. The exact-key misread stays. Effort:
    Small.
  - **C.** Add one helper to `packages/mokly/src/sidecar/path-pattern.ts`
    that puts the matched text into a target as written. Use it in the
    `paths` step and in the exports step, and add the same regression test.
    The exact-key misread stays. Effort: Small.
  - **D.** Add one key-aware helper to
    `packages/mokly/src/sidecar/path-pattern.ts`. Effort: Small.
    - It takes the key, the target, and the requested name.
    - For an exact key, it returns the target as written.
    - For a pattern key, it inserts the matched text as written. An export
      target gets it in every `*`. A `paths` target gets it in the first
      `*`.
    - Use it in `mappedPaths` and in the exports step.
    - Add two regression cases: a `$&` subpath under `"./*"`, and an exact
      key with a literal `*` in its target. Each case asserts the evidence
      entry, because no reuse result changes.
  - **E.** Stop recording export candidates. Use the package manifest digest
    and the consumed module, which already hold the folder that esbuild
    checks. It deletes live evidence of `main`, so it needs the user. It
    needs a native proof for each export form, and it removes protection if
    Mokly ever accepts a missing optional import. Effort: Medium.
- **Left out:**
  - Mark the evidence incomplete when the matched subpath holds a `$`. B is
    better on every point: it has the same effort and it keeps the reuse.
  - Resolve the import again with esbuild at each reuse check. The compiled
    recipe rules reject a second resolve, because it runs an esbuild
    operation on each reuse.
  - Copy the esbuild export resolver exactly. This is not a real choice: the
    step records every condition on purpose, and an extra candidate costs
    only reuse.
- **Shared assumptions:**
  - An exact key and a pattern key share one fill rule. Source: the code at
    `packages/mokly/src/sidecar/path-pattern.ts:10` and
    `resolution-evidence.ts:245`. The reason does not hold, because esbuild
    keeps the target of an exact key as written. D drops it.
  - The misread can hide a candidate that esbuild checks. Source: the first
    text of this item. The reason does not hold: an array skips only an
    invalid item, and a missing target fails the bundle. So no option has to
    prevent stale output.
  - The exports step builds its own candidate for each matching key. Source:
    the code and the recipe rule that the evidence records each folder where
    the resolver looks. It holds, but the consumed module holds that folder
    in each probed form. E drops it.
  - A reuse check runs no esbuild operation. Source:
    `docs/protocol/mokly-sidecar-recipes.md`. It holds. Kept.
- **Wider fix:** D. One key-aware helper then gives both pattern steps the
  target that esbuild resolves.
- **Previous examples:** The absolute paths fix of 2026-11-18 removed both
  defects from the `paths` step, when it moved that step to `mappedPaths`.
  Its test "an exact absolute paths key preserves literal target stars"
  failed first.
- **Recommendation:** D. It removes both misreads with the same Small effort,
  and as the structural helper it best protects the codebase. B and C each
  leave the exact-key misread.
- **Action:** fix after merge, apply D, because the exports step is outside
  the absolute paths fix, and the probes show no changed reuse result.
