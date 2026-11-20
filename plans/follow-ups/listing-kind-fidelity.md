# Folder listings omit special files that esbuild loads

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the design investigation of marked folder
  coherence of the second implementation review round of the branch
  `calummoore/mokly-folder-export-evidence-7rox`, which put this limit
  outside the scope.
- **Location:** `directoryFiles` in
  `packages/mokly/src/sidecar/resolution-inputs.ts`.
- **Reason:** The limit is the same on `main`, and the branch changes no
  listing.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Listing:** the sorted names of the regular files and symbolic links of
    one folder. The live checks of a compilation compare it with the disk.
  - **Special file:** a FIFO, a socket, or a device file.
- **Background:**
  - `directoryFiles` keeps only regular files and symbolic links. It returns
    an empty list for a missing path or a non-folder, through `ENOENT` and
    `ENOTDIR`.
  - From a reading of the esbuild 0.28.2 source, esbuild treats a special
    file as a file when it looks for candidates. No run checked this.
  - So a special file that appears at an earlier candidate path leaves the
    listing equal. An empty folder also gives the same listing as a missing
    path or a file.
  - Each compilation that uses listings shares this limit: the ordinary live
    checks of `main` and the folder checks of the branch.
  - Requirements that each option keeps: native esbuild selection stays
    authoritative, and a withheld reuse changes no output.
- **Problem:** A listing cannot see a special file that becomes a candidate,
  and it cannot tell an empty folder from a missing path or a file.
- **Impact if no action:** In a very unusual layout, reuse can keep a stale
  module until another live input changes. A fresh compile stays correct.
- **Root question:** How can a listing show each entry that esbuild can
  load, and the kind of a missing or non-folder path?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** List the name of each entry that is not a folder, with the
    current list format. Effort: Small.
  - **C.** B, and also record a distinct value for a missing path or a
    non-folder. It changes the list format of compiled recipes. Effort:
    Medium.
- **Left out:** Entry kinds in the private table: a marked table holds only
  file, absent, and link entries.
- **Wider fix:** C. Each listing then tells every case apart.
- **Previous examples:** None found.
- **Related:**
  [marked-post-build-coherence.md](./marked-post-build-coherence.md): its
  option A compares candidate names with these listings.
- **Recommendation:** B, after one native run confirms that esbuild loads a
  special file. It keeps the format. C best protects the codebase, if the
  case of an empty folder matters.
- **Action:** fix after merge, apply B, because the limit is Rare and the
  same on `main`, and B keeps the list format.
