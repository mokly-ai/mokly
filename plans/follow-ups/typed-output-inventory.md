# Output files can bypass shared admission

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-03, from `calummoore/remove-own-output-checks`, the wider fix of review finding 1.
- **Location:** `crates/mokly-model/src/output/artifact.rs:41` and `crates/mokly-static/src/inventory.rs:16`.
- **Reason:** The wider fix changes a shared Rust API and its callers beyond the focused resource-limit correction.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Artifact:** The finalized output files, typed ownership, and optional upload metadata in `mokly-model`.
  - **Inventory:** The static writer's path, collision, and file-size admission in `mokly-static`.
  - **Admitted file set:** A type that can hold a file only after the existing output checks succeed.
- **Background:** Every regular output file has a 64 MiB limit under `docs/protocol/mokly-export.md`. Each path must also be portable and collision-free. Static assembly now admits assets, views, comparison files, and generated metadata through Inventory before finalization. The marker and manifest keep their existing byte limits at their writers.
- **Problem:** `Artifact::finalize` still accepts a raw `Vec<File>`. Its type does not show that the ordinary files passed admission. A later producer can append a file after consuming Inventory and repeat the bypass.
- **Impact if no action:** Correctness continues to rely on each producer following the existing admission path. A future bypass can install output that its next build cannot replace.
- **Root question:** How can every output producer preserve the existing file limits before installation?
- **Options:**
  - **A.** Check all file lengths in `Artifact::finalize`. This keeps the raw API and repeats checks for files already admitted. It also reports a generic format error instead of naming the file. Effort: Small.
  - **D.** Use the final staging inventory to check paths, collisions, and sizes. This names the failed file and covers every staged file. It repeats length comparisons for earlier admissions. Effort: Small.
  - **E.** Move shared admission next to the marker writer in `mokly-model`. Require its admitted file set in `Artifact::finalize`. Only its insertion method adds ordinary files. Identity reads those files, then inserts generated index and detail files. This changes the shared API and its callers. Effort: Medium.
- **Left out:** The generated-metadata admission fix is already applied. A separate bounded encoder at each metadata writer leaves other producers able to bypass admission. Raising or removing limits changes requirements that remain in force. Splitting the index changes the read model and upload plan. Depending on upload preparation misses plain builds and runs after publication output is installed.
- **Wider fix:** E. The admitted type prevents a caller from supplying an unchecked ordinary file.
- **Previous examples:** The removal of final output checks exposed oversized generated index files and oversized ownership markers. Direct writer and inventory fixes preserved both existing limits. The marker reader still rejects an entry size above 67108864, so a successful build must not install such an entry.
- **Recommendation:** E. It keeps one admission per file and makes that state part of the API.
- **Action:** fix after merge, apply E. The current writer flow is corrected, and the wider shared-API migration can proceed as a separate requested task.

Preserve the user decision of 2026-11-03: check author and external input once,
then trust typed output from the same Mokly version. This task adds no schema
reparse, repeated hash, new resource limit, or gate. Migrate every consumer of
the raw finalizer API. Keep final filesystem path safety and persisted
ownership parsing. Add only tests of the existing boundary requirements.
