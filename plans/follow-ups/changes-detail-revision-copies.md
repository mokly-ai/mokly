# Changes copies every detail to stamp a revision

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`: a
  problem that the options check of its design calls found outside the
  scope.
- **Location:** `crates/mokly-server/src/changes.rs:192` (`project`).
- **Reason:** The code is on `origin/main` outside the diff of that branch,
  and nobody measured its cost.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Detail:** one `EntryDetailV4` record of a catalogue entry, held behind
    an `Arc` in `Snapshot::details`.
- **Background:**
  - `changes::project` builds the next snapshot from a clone of the current
    one. Then, for each detail of the next snapshot, it calls
    `Arc::make_mut(detail).revision = Some(next.index.revision)`.
  - The clone shares each detail `Arc` with the current snapshot, so
    `make_mut` copies every detail before it sets the revision. mokly-cloud
    has 1,508 views and 167 entries.
  - This runs on each Changes publication, on the path to the Changes
    result.
  - The `README.md` of `mokly-server` says that each response inserts the
    current revision into the stored bytes, and that reuse never changes the
    typed `revision` that a phase stamps on its details.
- **Problem:** Each Changes publication may copy every detail only to stamp
  a revision.
- **Impact if no action:** The Changes result of each edit can wait for these
  copies. Nobody measured how long they take.
- **Root question:** How does a Changes publication give each detail its
  revision without a copy of every detail?
- **Options:**
  - **A.** Measure the loop on mokly-cloud first, with a temporary span.
    Effort: Small.
  - **B.** Copy and stamp only the details that change in this publication,
    and keep the shared `Arc` of the others, if the reuse rule allows it.
    Effort: Medium.
  - **C.** Stamp the revision only at the encoding, and keep the typed
    details free of it, if every typed consumer can take the revision from
    the snapshot. Effort: Large.
- **Left out:** None.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** None found.
- **Recommendation:** A, then B if the measurement shows a cost.
- **Action:** fix after merge, apply A, because the code is outside the diff
  of the branch that found it.
