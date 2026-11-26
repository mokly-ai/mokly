# The sized-listing proof drops some errors of the old object check

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Open finding.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, findings 1, 5, and 6 of its review and their finding checks. The three findings share one policy question, so they share this item.
- **Location:** `crates/mokly-git/src/presence.rs` (`GitRepository::presence`), `crates/mokly-git/src/checkout_index.rs` (`settings_listing`), `crates/mokly-git/src/fetch.rs` (the missing-object walk), and `docs/protocol/mokly-git.md` (Child Environment and the presence check).
- **Reason:** The recommended option changes which missing objects keep a typed error, so the user decides.

- **Terms:**
  - **Replacement ref:** A ref under `refs/replace/` that tells Git to read a substitute object in place of an original. Mokly keeps the user's replacement refs, as `docs/protocol/mokly-git.md` says.
  - **Sized-listing proof:** Without a promisor remote, one `git ls-tree -l` of the requested paths and their ancestor `.gitattributes` files. When each blob record has a decimal size, the base read skips the `rev-list --missing=print` walk.
- **Background:** A base read checks that each object exists before it reads the bytes, so that a missing object gives the typed `MissingObject` error. The walk asks for the stored original. `ls-tree -l` and the read (`cat-file --batch --filters`) follow replacement refs. The whole-tree settings listing has used the size proof since #344. The branch above extends it to exact lookups, root listings, and conversion reads.
- **Problem:** When an original blob is missing and a replacement ref names a present substitute, the size proof passes, and the read returns the substitute bytes, as `git show` does. Before the branch, the walk returned `MissingObject` for these reads. A request that takes the fallback (more than one argument batch, or nested paths) still returns `MissingObject`. A Git 2.43.0 scratch repository showed each case. With `core.maxTreeDepth=1`, the walk failed with `CommandFailed` where the listing of a root file succeeds. A deeper path still fails the listing and keeps `CommandFailed`.
- **Impact if no action:** In this rare setup, a base read returns the bytes that the user's Git reads, where it used to fail. The typed error depends on the request shape.
- **Root question:** How can a base read prove, with the fewest Git processes, that Git can read each object that the read uses, so that the proof and the read agree?
- **Options:**
  - **A.** Reuse the listing only for whole-tree reads, and run the walk for every other read. This gives up most of the process savings. Effort: Medium.
  - **B.** Keep the combined listing, and feed its records into the walk on every read path. One lookup and one read then start 5 processes in place of 3 (6 before the branch). Add regression tests for the missing original and the depth limit. Effort: Medium.
  - **D.** State the rule: a base read follows replacement refs, so an object counts as present when Git can read it. Clarify the presence sentence of `docs/protocol/mokly-git.md`. Add one regression test: a replaced, missing original reads the substitute bytes. The fallback shapes keep `MissingObject`. Effort: Small.
  - **E.** Do D. Also, without a promisor remote, when the walk reports missing blobs, run one `cat-file --batch-check` of those IDs and drop each ID that Git can read. Every request shape then gives one answer. One more process runs only when the walk finds a missing blob. Effort: Medium.
  - **F.** Run the sized listing only when no ref exists under `refs/replace/`: one `git for-each-ref --count=1 refs/replace/` per call, with no cache. This keeps the old answer for replaced objects and starts 5 processes for one lookup and one read. Effort: Small.
- **Left out:** Turning off replacement refs for the listing, because the listing then gives other sizes than the read, and it proves other files when a commit or a tree is replaced. A check inside the read process, because `--attr-source` skips a missing attribute blob without an error.
- **Wider fix:** E, because every presence check then asks Git the question that the read asks.
- **Recommendation:** D. The new answer is the answer of the read and of the user's Git, and D keeps the measured savings (3 processes in place of 6 for one lookup and one read). Choose E for one rule across request shapes. Choose F to keep the old typed error exactly.
- **Action:** ask the user, because D and E change the requirement for missing objects in `docs/protocol/mokly-git.md`, and F and B keep it at the cost of two more processes per read.

## Related finding 5: a lookup can return a directory whose tree is missing

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small.
- **Problem:** Git prints a directory record without opening its tree. On Git 2.43 and 2.44, the old walk failed with `CommandFailed` when a requested directory's tree was missing and the batch held a blob. The sized listing returns the directory. On Git 2.45 and later, which development and CI require, `origin/main` and the branch both return the directory. On every version, the first listing or read below the directory returns `CommandFailed`.
- **Options:** **A.** Run the old walk when an exact lookup returns a directory (restores the Git 2.43 and 2.44 error only; Small). **C.** One `git cat-file --batch-check` of returned directory records, with `MissingObject` for a missing tree (a new failure on Git 2.45 and later; Small). **E.** State the rule: an exact lookup proves the blobs and attribute files that it returns, and the first read below a returned directory reports the damage. Write it with option D above, and test that a listing below a directory with a removed tree returns `CommandFailed` (Small).
- **Recommendation:** E, decided together with the main item.

## Related finding 6: a recursive listing can skip an argument limit

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small.
- **Problem:** The old object check of `Repository::list` built the attribute path of each listed entry and returned `ArgumentLimit` for one over the 16 KiB command budget, for example a file below 82 directories with 100-byte names. The sized whole-tree and root listings skip that check and return the entries. Each lookup, read, and extraction that passes the deep path still returns `ArgumentLimit`. The settings read on `origin/main` already skips the check.
- **Options:** **A.** Check the longest attribute path of the listed entries at the two `list` call sites, with the cost from `batches::split` and the old command prefix, and run the old check when one does not fit (Small). **C.** State the rule: a reader returns `ArgumentLimit` only for a path that one of its commands passes; add a test with a deep descendant (Small). **D.** C, and one check in `extract_sources` after its listing, so extraction of a deep file fails before the first batch converts (Small).
- **Recommendation:** C, decided together with the main item. Take A to keep the old error.
