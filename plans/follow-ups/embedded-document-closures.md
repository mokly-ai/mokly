# Closures skip catalogue documents that a pane embeds

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from round 2 of the review of branch
  `calummoore/startup-performance-optimization`: an outside-scope note,
  finding 3, and a new problem of its check.
- **Location:** `crates/mokly-graph/src/closure.rs:115`,
  `crates/mokly-server/src/comparison_capture.rs:181`,
  `crates/mokly-server/src/comparison_files.rs:87`, and
  `docs/protocol/mokly-public-closure.md:61`.
- **Reason:** The review found the problem in code that the branch did not
  change, and nobody reproduced it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Catalogue document:** a document that Mokly renders for a screen,
    component, page, or Markdown entry, under `static/mokly-generated/`.
  - **Closure:** the set of resources that one document loads, which the
    graph walks from the document's HTML and CSS.
  - **Selected generation:** the comparison files that Serve captures when
    a reviewer opens a comparison of one entry.
  - **Pane:** one side of a comparison. The viewer shows the snapshot HTML
    in a frame, with a base address on that side.
- **Background:**
  - A screen can embed another catalogue document through `iframe`,
    `object`, or `embed`. `crates/mokly-graph/tests/url_tests.rs:63` tests
    an iframe embed. `crates/mokly-compare/src/css_documents.rs:50` treats
    all three elements as embedding.
  - The closure walk skips a target that is a catalogue document, at
    `crates/mokly-graph/src/closure.rs:115`. The rule "The walk stops at a
    catalogue page link" in `docs/protocol/mokly-public-closure.md:61`
    keeps one closure from rendering the whole catalogue. That reason holds
    for navigation links, but a pane loads an embedded document.
  - Serve's selected capture copies each requested document and the edges
    of its closure, at `crates/mokly-server/src/comparison_capture.rs:181`.
    So it never stores an embedded catalogue document.
  - A request for a missing snapshot file renders it on demand only for
    the before side of a removed entry, at
    `crates/mokly-server/src/comparison_files.rs:87`.
  - A static build writes every document to both snapshot sides today, in
    `crates/mokly-static/src/comparison_files.rs:31`. So static comparisons
    still show embedded documents.
  - The skip also comes before the evidence record at line 125. So a change
    to an embedded document records no resource evidence for the host view.
- **Problem:** In Serve, a comparison pane that embeds a catalogue document
  requests a snapshot file that the selected generation does not hold. Each
  rule that writes fewer static snapshots would have the same gap.
- **Impact if no action:** Serve comparison panes show an empty frame where
  the embedded document belongs. Changes can also show a host view as
  Unmodified when only its embedded document changed.
- **Root question:** How does each comparison generation keep every file
  that a pane loads, including the catalogue documents that it embeds?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** In Serve's selected capture, also copy each catalogue document
    that a captured document embeds, on the same side and transitively,
    with its closure. Effort: Medium (estimate).
  - **C.** Let the closure record each embedding edge to a catalogue
    document, by element kind, and keep stopping at navigation links.
    Static output, Serve capture, Changes evidence, and every snapshot rule
    then use one list of what a pane loads. This changes the closure rule of
    `docs/protocol/mokly-public-closure.md`. Effort: Large (estimate).
- **Left out:** A new build error for embedded catalogue documents. It
  breaks an input that `url_tests.rs:63` tests.
- **Wider fix:** C. One list of loaded files serves every writer and every
  snapshot rule.
- **Previous examples:** None found.
- **Related:**
  - [unread-comparison-snapshots.md](./unread-comparison-snapshots.md) and
    [skip-equal-before-snapshots.md](./skip-equal-before-snapshots.md):
    both rules need the list of embedded documents that option C records.
- **Recommendation:** C. It fixes Serve, Changes evidence, and both snapshot
  rules with one rule. B fixes Serve alone without a protocol change.
- **Action:** ask the user, because option C changes the closure rule of a
  protocol page, and the evidence change alters which views Changes lists.
