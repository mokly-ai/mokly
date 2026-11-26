# Runtime requires keep digests for every workspace build

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from finding 133 of the review of branch `calummoore/mokly-source-package-override-jkum`.
- **Location:** `packages/mokly/src/sidecar/workspace-lookups.ts`, `packages/mokly/src/sidecar/bundle-recipe.ts`, `packages/mokly/src/sidecar/physical-input-reader.ts`, `crates/mokly-sidecar/src/compiled.rs`.
- **Reason:** the direct fix keeps correct output now, and the wider fix changes both reuse readers.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Marked edit evidence:** the files that Serve checks before it reuses a bundle after an edit. A present file carries a digest of its content or, for a file whose content cannot change the result, only its path.
  - **Unresolved require:** a computed or indirect `require`, a direct `eval`, or an external require that the runtime resolves after Mokly captures the evidence.
- **Background:** a workspace lookup records a build file that the bundle does not use as a path-only entry, so a large unused build keeps edit reuse. An unresolved require can load such a build file at run time, after the evidence goes to Rust. So when a bundle has an unresolved require, Mokly keeps a digest for every recorded workspace build file. A build file above the 1 MiB metadata bound then still removes edit reuse.
- **Problem:** a bundle with an unresolved require loses edit reuse when any recorded workspace build file passes the bound, also when no run-time load reads that file.
- **Impact if no action:** Serve compiles again after each edit for such bundles. The output stays correct.
- **Root question:** how does Serve check a build file that a run-time require may load, without a digest for each build file that no load reads?
- **Options:**
  - **A.** Keep the current rule. Effort: Small.
  - **B.** Record the digest of each file that a run-time require loads, and pass these digests to both reuse readers, so only loaded build files need a digest. Effort: Large.
  - **C.** Build B into the shared resolution record of `workspace-import-resolution-record.md`. Effort: Large.
- **Left out:** a higher metadata bound, because the read cost stays and the problem returns above the new bound.
- **Wider fix:** C.
- **Previous examples:** finding 133 of the same review.
- **Recommendation:** B. It keeps reuse for each build file that no run-time load reads.
- **Action:** fix after merge, apply B, because it changes both reuse readers and the direct rule already keeps the output correct.
- **Done when:** a bundle with a computed require and an unused build file above 1 MiB keeps Serve edit reuse, and an edit to a build file that the computed require loads still ends it.
