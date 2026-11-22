# Background walk records follow the kept facts

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from finding 1 of the round 1 review of branch
  `calummoore/mokly-edit-background-render-olos`: the wider fix that the
  branch split off.
- **Location:**
  - `crates/mokly-graph/src/session_render.rs:55`: `finish_artifact`, which
    keeps a walk record only for a background read of a route with a
    viewport.
  - `crates/mokly-graph/src/head_walks.rs:46`: `PassWalks::insert`, the
    records of one generation within two MiB.
  - `crates/mokly-compare/src/validation_kept.rs`: `Head::kept_view`, which
    proves an unchanged view from the kept facts of the last accepted
    classification.
  - `crates/mokly-compare/src/reuse_budget.rs:41`: the bound that can clear
    every optional arena of kept facts.
- **Reason:** The wider fix needs a new interface from `mokly-compare`
  through `mokly-server` into `mokly-graph`, which is larger than the review
  fix of the branch that found it.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Walk record:** the read set of one background closure walk, which the
    Changes classification of the same generation replays instead of a second
    walk. All records of one generation share a cap of two MiB.
  - **Kept facts:** the validated facts of each view that the last accepted
    Changes classification keeps, so that the next classification can prove
    an unchanged view without a document read.
  - **Background pass:** the Serve work after each edit that reads each route
    of the new state whose usage is not completed. Only views, the routes
    with a viewport, complete. So the pass reads each page and Markdown
    document again after each edit.
- **Background:**
  - Since 2026-11-22, a Serve background read records its closure walk, and
    the classification of the same generation replays the record once. The
    decision of 2026-11-22 for that change requires that these records stay
    bounded by the changed views of one pass and end with it.
  - The round 1 review of that branch found that the pass also kept a record
    for every unchanged page and Markdown document, which the classification
    never used, because it proves those documents from kept facts.
  - The fix keeps a record only for a background read of a route with a
    viewport. So an edited page or Markdown document walks again in its
    classification, as before 2026-11-22.
  - This rule depends on which routes the pass reads. If a later change
    completes unchanged pages and Markdown documents, the rule loses the
    replay of an edited page for no gain.
  - The classification also has no kept facts on its first run after Serve
    starts, and after the bound clears the arenas. Then it walks each view
    whose record did not fit in the cap.
- **Problem:** A fixed rule, the viewport, decides which background reads
  keep a walk record. The rule does not follow what the classification can
  use.
- **Impact if no action:** An edited page or Markdown document walks twice,
  once in the pass and once in its classification. A later change of the
  routes that the pass reads can make the rule keep records that nothing
  uses, or drop records that the classification needs.
- **Root question:** Which background reads keep a walk record, so that a
  pass keeps only records that its own classification can use, and their
  total size follows the changed documents, not the catalogue?
- **Options:**
  - **A.** Keep the viewport rule. Effort: Small.
  - **B.** Keep a record for each view, and for a page or a Markdown document
    only when its lookup missed the cache and the pass composed it. An edited
    page keeps its record in the usual case. An undo of a page edit hits the
    cache and walks again, and an unchanged page that the cache evicted still
    keeps an unused record. Effort: Small.
  - **C.** Let the snapshot projection mark each page and Markdown document
    whose document key differs from the previous snapshot, and keep a record
    for each view that the pass reads and for each marked document. It
    changes the background read interface of `mokly-graph` and
    `mokly-server`. Effort: Medium.
  - **D.** Let the owner of the kept facts decide. Before the pass, the
    Changes side gives the graph a check of whether the last accepted
    classification keeps facts and outputs for a route and its current
    document key. A background read keeps a record only when it does not.
    The records then match the walks of the classification, also on the
    first classification and after the bound clears the arenas. A stale
    answer costs only a walk. Effort: Large.
- **Left out:** Starting the changed views first, so that their records fit
  first: the protocol requires catalogue order.
- **Wider fix:** D. It still holds when the routes that the pass reads
  change.
- **Previous examples:** None found.
- **Related:**
  - [serve-pass-rereads-unchanged-pages.md](./serve-pass-rereads-unchanged-pages.md):
    if it completes unchanged pages and Markdown documents, the viewport rule
    must go, and B, C, or D replaces it.
- **Recommendation:** D, when a measurement shows walks of edited pages or of
  first classifications on a real catalogue. Until then, A costs only the
  walks that Serve made before 2026-11-22.
- **Action:** fix after merge, apply D, because it needs a new interface
  across three crates, and its gain is the replay of edited pages and
  Markdown documents only.
