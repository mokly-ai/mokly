# The pass rereads unchanged pages and documents

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from the Outside the scope list of the round 1 review
  of branch `calummoore/mokly-edit-background-render-olos`.
- **Location:**
  - `crates/mokly-server/src/background.rs:115`: the background pass skips
    only the routes whose usage is completed.
  - `crates/mokly-server/src/publication.rs:167`: `completed_many` completes
    only the routes of `origin.views`, the routes with a viewport.
  - `crates/mokly-server/src/snapshot.rs:193`: the routes of a snapshot hold
    every document plan, pages and Markdown documents included.
  - `crates/mokly-cli/src/serve_warnings.rs:80`: each attempt after a
    successful one clears the set of printed warnings.
  - `crates/mokly-graph/src/session_render.rs:55`: a background read of a
    route without a viewport keeps no walk record.
- **Reason:** The code lies outside the diff of the branch that found it, and
  on 2026-11-22 the performance orchestrator asked to rank it with the other
  cuts of the pass. Its ranking of that date chose H, W1, and C1 and did not
  name this cost. So the cost waits for the next ranking of the
  orchestrator.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the Serve work after each edit, the
    `serve.background` span, which reads each route of the new state in
    catalogue order and skips each route whose usage is completed.
  - **Page and Markdown document:** a catalogue entry whose document has no
    viewport. Its route has no usage to complete.
  - **Walk record:** the read set of one background closure walk, which the
    Changes classification of the same state can replay instead of a second
    walk.
- **Background:**
  - Only views complete. After an edit, Serve keeps the usage of each view
    whose document key did not change and marks that view completed. A page
    or a Markdown document never completes, so the pass reads it again after
    each edit, also when its document key did not change.
  - A read of an unchanged document hits the cache, but it still runs the
    closure walk and the link checks of the document.
  - The read also prints the warnings of the document again, because each
    attempt after a successful one clears the set of printed warnings. So a
    plain skip changes the printed output.
  - Measurements of 2026-11-22, with `--debug-timings`: the reads whose
    `render.document` record has the viewport `none`, inside each
    `serve.background` span.
    - mokly-cloud at `194fdb78` (283 screens, 94 components, 4 use cases,
      and no pages or Markdown documents): 0 such reads in each warm pass,
      beside the 44 view reads of a one-line edit. So each warm edit spends 0
      reads, 0 sidecar calls, and 0 core time on this work.
    - `examples/basic` (2 pages and 4 Markdown documents): 15 such reads in
      each pass. In a warm pass their spans add up to 2 to 15 ms, at most
      3 ms each, with 0 to 2 sidecar render calls.
  - A review fix of 2026-11-22 on the branch that found this problem keeps no
    background walk record for a page or a Markdown document, because the
    pass reads each of them again after each edit. If a fix here completes
    the unchanged pages and documents, it removes that viewport condition, so
    that an edited page or document keeps its walk record and its
    classification replays it.
- **Problem:** The pass reads and walks every unchanged page and Markdown
  document again after each edit.
- **Impact if no action:** A catalogue with many pages or Markdown documents
  spends core time after each edit on reads whose output did not change. On
  mokly-cloud the cost is zero.
- **Root question:** How can the pass skip the work of an unchanged page or
  Markdown document and print the same warnings?
- **Options:**
  - **A.** Change nothing. The measured cost is zero on mokly-cloud and a few
    milliseconds on `examples/basic`. Effort: Small.
  - **B.** Complete a page or a Markdown document like a view when its
    document key did not change, keep its warnings, and print the kept
    warnings without a read. Remove the viewport condition of the walk
    record. Effort: Medium.
  - **C.** Keep each read, but skip the closure walk and the link checks of a
    cache hit when the inputs of the document are proven unchanged by content
    identities, as the head validation of Changes proves an unchanged view.
    Effort: Medium.
- **Left out:** A skip of the reads and of their warnings. It changes the
  printed output.
- **Wider fix:** None, because this is a speed opportunity, not a class of
  defect.
- **Previous examples:** None found.
- **Related:**
  - [serve-edit-background-pass-split.md](./serve-edit-background-pass-split.md)
    holds the safe CPU cuts of the pass and the ranking of 2026-11-22, which
    chose H, W1, and C1 and did not name this cost. H, W1, and C1 were then
    measured and reverted. Until 2026-11-22 this line said that the next
    speed pull request ranks the cuts with this cost.
  - [background-walk-records-from-kept-facts.md](./background-walk-records-from-kept-facts.md)
    holds the choice of the reads that keep a walk record.
- **Recommendation:** B, if a ranking of the performance orchestrator chooses
  this cost. It removes the reads and keeps the printed warnings. On the data
  of 2026-11-22 the cost ranks last, because it is zero on mokly-cloud.
- **Action:** ask the user, because the work waits for a ranking of the
  performance orchestrator, and its ranking of 2026-11-22 did not name this
  cost.
