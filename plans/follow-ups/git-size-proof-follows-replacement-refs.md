# The sized-listing proof follows replacement refs

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Open finding.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, finding 1 of review round 1 and its finding check.
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
