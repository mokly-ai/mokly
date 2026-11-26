# Page-render requires skip the ignored-module warning

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the fix of finding 2 in round 1 of the review of branch `calummoore/mokly-source-package-override-jkum`.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:75`, `crates/mokly-compare/src/ignored_modules.rs`.
- **Reason:** the evidence must pass through document rendering and render reuse, which the review fix did not change.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **`ignored-module` warning:** the configuration warning that names each file that the head loads and Git ignores, when Changes runs, because a later base cannot load it.
  - **Restored page-render require:** the Node `require` that a rendered page uses for a module that the bundle keeps external.
- **Background:** the warning reads the files that the head's bundled imports, CSS imports, and PostCSS loads reached. The fix of finding 2 added the modules that the PostCSS worker loads through Node. A rendered page can also load a module through its restored runtime require. That require uses its own `ModulePaths`, and no render result reports the files that it loads.
- **Problem:** an ignored repository file that only a restored page-render require loads gives no `ignored-module` warning.
- **Impact if no action:** a strict build passes with such a file. A later base cannot load the file, and Changes becomes unavailable after the merge.
- **Root question:** how does the warning learn of each repository file that a page render loads through Node?
- **Options:**
  - **A.** Add the files that the restored require loads to the render result, keep them in the render reuse record, and pass them to the warning input. Effort: Medium.
  - **B.** Build the require evidence into the shared resolution record of `workspace-import-resolution-record.md`. Effort: Large.
  - **C.** Load-test the head in a view that hides ignored files. Effort: Large.
- **Left out:** a warning for every file that the sidecar process observes, because it also counts Mokly's own runtime files and template reads.
- **Wider fix:** B, because one record then carries the evidence of every loader.
- **Previous examples:** findings 2 and 80 of the same review, where PostCSS loads first escaped the warning.
- **Recommendation:** A. It closes the gap with the existing render result and reuse record.
- **Action:** fix after merge, apply A, because the evidence must pass through render reuse, which this change does not touch.
- **Done when:** a page whose render requires an ignored repository file gives one `ignored-module` warning when Changes runs, also when Serve reuses the render.
