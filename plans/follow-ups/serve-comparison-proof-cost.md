# Proofs of reused Serve views stay costly

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from `calummoore/mokly-comparison-reuse-1see`, the
  performance orchestrator's follow-up call after the release measurement of
  Serve comparison reuse, with the read-only options check of the same day.
- **Location:** `crates/mokly-compare/src/comparison_slots.rs:92-118`,
  `crates/mokly-compare/src/reuse_reads.rs:171-200`,
  `crates/mokly-compare/src/reuse_probes.rs:147-195`,
  `crates/mokly-compare/src/reuse_usage.rs:27-55`,
  `crates/mokly-compare/src/comparison_consumer.rs:200-218`,
  `crates/mokly-compare/src/comparison.rs:67`,
  `crates/mokly-server/src/comparison_graph.rs:59-91`,
  `crates/mokly-graph/src/session.rs:183-192` and `:212`,
  `crates/mokly-graph/src/session_collection.rs:89`,
  `crates/mokly-graph/src/session_proof.rs:28-61`,
  `crates/mokly-graph/src/validation.rs:37-69` and `:71`,
  `crates/mokly-graph/src/cache.rs:173-189`,
  `crates/mokly-graph/src/document_codec.rs:26-31` and `:133`, and
  `crates/mokly-graph/src/types.rs:143-149`.
- **Reason:** On 2026-11-17 the user asked to record the proof cost in the
  reuse pull request with no code change, and to choose an option in a later
  branch.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Proof:** the check that every recorded input of a kept view comparison
    still has the same content identity.
  - **Checked head read:** `comparison_document_proof` on the Serve head,
    which reads the current document through the `FrozenResources` checks
    and returns its identity and current usage.
  - **Link check:** `validation::links` in
    `crates/mokly-graph/src/validation.rs`, which reads every view of the
    target entry of each fragment link and looks for the anchor.
  - **Render cache:** the bounded document cache in
    `crates/mokly-graph/src/cache.rs`, whose compact tier keeps compressed
    documents that a read must restore.
  - **`render_all` pass:** the pass over every head view that
    `Engine::compare_reusing` runs before the view stream.
- **Background:**
  - Serve keeps the view comparisons of its last accepted classification
    under a fixed bound of at most 32 MiB. A later classification reuses a
    view only when its proof shows that every recorded input is unchanged.
  - Each recorded input of a proof is a side, a kind, a route, and an
    identity. A worker runs the proof before it would prepare the view.
  - Every catalogue-wide step runs again, and published bytes equal a full
    comparison. "Proven view reuse" in
    `docs/protocol/mokly-changes-serving.md` and "View Comparison Reuse" in
    `docs/protocol/mokly-comparison-serving.md` hold these requirements.
  - Base proofs read only retained digests, in `ProofMode::Retained`. Head
    proofs read current identities. A failed head read is a miss, and the
    view is compared in full.
  - `Probes`, one bounded identity table for each comparison attempt, shares
    each identity by side, kind, and route across all views. Recording and
    proofs both use it.
  - A reused head view needs one checked head read. That read has these
    parts:
    - A render cache read of the view's own document. It can restore a
      compact entry.
    - The byte digest check of `FrozenResources`, a SHA-256 of the bytes.
    - The link checks. For each fragment link, they scan every entry and
      every document plan. Then they read each target view, walk its whole
      tree for anchors, and insert it into the render cache again.
    - A copy of the current usage.
  - The render cache has a full tier of ready documents and a compact tier
    of compressed documents.
  - A render cache insert computes the entry weight before it checks the
    full tier. That computation encodes the usage as JSON and walks every
    node. The checked head read inserts its own document and each link
    target again.
  - The `render_all` pass reads every head view, finds its anchors in
    `session_collection.rs:89`, and checks every fragment link in
    `validation::completed`. Then
    `session.rs:212` drops those anchors. The pass does not run the digest
    check of `FrozenResources`. In Serve, it is the only complete head
    validation of a classification.
  - Compact cache entries keep the usage and the links outside the
    compressed payload, in `document_codec.rs:26-31` and `:133`.
  - `FrozenResources` keeps the default `comparison_usage`, which calls
    `comparison_document`, in `types.rs:143-149`. So a usage read through it
    runs the checked head read again.
  - On the large HTML fixture, 4,800 of the 5,850 head views are screen
    views. Each links to `#summary` on the next screen, in
    `tests/fixtures/large/html.ts:124`. So each of their checked head reads
    reads five documents: its own and the four views of the next screen.
  - Measurement setup:
    - `main` at `03bedb6ec` against the implementation at `38b923b5c`. These
      numbers are historical. The branch later merged `main` at `0accb6818`
      and at `51f356574`, which adds the kept base of Serve. The later
      runtime can give other numbers.
    - Release builds ran in separate checkouts and target directories.
    - Each side ran 3 samples, each with one edit and an exact restoration.
      An event-stream observer measured HTTP Ready.
    - The large HTML fixture of `tests/fixtures/large/README.md` ran with its
      defaults: 30 areas, 40 screens, 12 rows, and 4 stylesheets, which give
      5,850 views.
  - Medians on the large HTML fixture:
    - Full comparison after the edit: 19,126 ms. Reuse comparison after the
      edit: 7,787 ms.
    - Reused views: 5,846. Compared views: 4.
    - `revalidationMs`, the summed proof work: 20,620.890 ms.
    - `currentUsageMs`: 20,532.151 ms.
    - `recordedReads`: 69,540. `identitiesChecked`: 69,510.
      `identityReads`: 23,410.
    - Charge: 19,667,054 B at the first peak, and 19,249,170 B resident
      after the edit and after the restoration. The bound was 32 MiB, and no
      overflow occurred.
  - The duration fields sum the work of each call across threads. They are
    not parts of the 7,787 ms wall-clock time.
  - `currentUsageMs` times three things: the checked head reads, the base
    usage reads and moves of the ordered consumer in `reuse_usage.rs:27-55`,
    and the usage copies of compared views in
    `comparison_consumer.rs:200-218`. `revalidationMs` also contains the
    checked head reads.
  - Derived from the counters and the code, not measured:
    - The proof work is about 3.5 ms for each reused view.
    - Each reused view has about 12 identity checks.
    - `identityReads` fits 4 reads for each reused view, for its own two
      documents and two closures, plus 26 shared resource identities. This
      fits the sharing of `Probes`.
    - The two duration sums differ by about 89 ms. So the identity checks
      outside the checked head reads take about 89 ms more than the base
      usage reads and copies. The sums do not show which part of the checked
      head read costs most.
  - Timing split, required before any option except A:
    - Time the checked head read alone, and each of its parts: the own cache
      read and restore, the link checks, the cache inserts, the digest, the
      identity, and the usage copy.
    - Read the restore count of the render cache before and after the view
      stream, as a cheap extra count.
    - Time the other phases of the comparison too: the `render_all` pass,
      the entry pairing, the ordered consumer, and the steps that combine
      views.
    - The split is a one-time measurement. Its output goes under `.context/`
      of that branch, and it gets no test.
- **Problem:** Each reused view still costs about 3.5 ms of summed proof
  work, and the edit comparison still takes 7,787 ms on the large HTML
  fixture. No measurement maps that summed work onto the wall-clock time. No
  counter splits the checked head read into its parts.
- **Impact if no action:** Large catalogues keep a comparison of several
  seconds after each edit, although Serve reuses nearly every view. Without a
  timing split, a later change can target a phase that is not the main cost.
- **Root question:** How can Serve prove reused views with less work, and
  keep byte equality, current usage, checked head validation, retained-only
  base reads, and the fixed memory bound?
- **Options:**
  - **A.** Keep the per-view proof as it is. The edit comparison stays at
    about 7.8 s on this fixture. Effort: Small.
  - **B.** Group the views of one entry on one worker, and share their
    common checked work, such as the link targets that the link checks read.
    Each view keeps its own document, closure, and usage proof. The saving
    is limited to work that `Probes` does not share, and it needs a new
    schedule. Effort: Medium.
  - **C.** Reuse the head checks of the same comparison. Let the
    `render_all` pass and the proof share one checked read for each head
    view, and let the generation keep its result with the byte digest. The
    proof then needs no second checked read. Effort: Large.
    - The pass and the proof must run the same checked read. A record that
      copies the checks is a second check path. Then reused views would skip
      a check that a full comparison runs.
    - C must name a usage source that needs no restore, such as the read of
      F. A usage read through `comparison_usage` runs the checked head read
      again, and then C saves almost nothing. If C keeps the usage in its own
      record, that record must fit a fixed bound.
    - `FrozenResources` must apply its digest check, and current usage must
      come from the current generation.
  - **D.** Extend the identity of a head document with its validated
    dependencies: the target documents and anchors that the link checks
    read. A proof then checks their identities instead of running the link
    checks again. The byte digest still needs a checked read in this
    comparison. A missed dependency would publish stale output. Effort:
    Large.
  - **E.** Share the link checks inside one head generation. Effort: Medium.
    - Index the document plans by entry path, so that a link check scans no
      full list.
    - Check each pair of target view and fragment once for each generation.
    - Fill these results first from the anchors that the `render_all` pass
      finds, which it drops today.
    - Skip the weight computation when an insert finds the same artifact in
      the full tier.
    - Every check still runs on the current generation. The checked head
      read stays the only proof path. The first error and its text stay the
      same.
    - By code reading, not measured: on the large HTML fixture, E cuts the
      target reads of the screen views by at least three quarters. With the
      results of the `render_all` pass, it removes all of them.
    - Full Serve comparisons and Serve page reads run the same link checks,
      so they also get faster.
    - Cost: a small store for each generation, with one record for each
      linked pair of target view and fragment. Concurrent checks of one
      target need care.
  - **F.** Read the digest, the usage, and the links of a cached head
    document without restoring its tree. Effort: Large.
    - Keep the byte digest of each cached document with its cache entry.
    - Add a generation read that returns that digest, the current usage, and
      the links. `FrozenResources` applies its digest check to that read.
    - The default of the new read calls `comparison_document`. So a checking
      wrapper that does not implement the read keeps its checks.
    - A cache miss renders and hashes, as it does now.
    - Cost: a changed shared cache entry, a new trait read, and a review of
      every checking wrapper. The anchors of link targets still need E or a
      restore.
- **Left out:**
  - One content identity for each distinct resource and generation, shared
    by all views. `Probes` already does this in each comparison attempt, so
    it is not a new option.
  - A proof for each entry instead of each view. Each view has its own
    document, closure, and usage, so a per-entry proof is not complete
    without them. B keeps the inputs of each view.
  - A reused head view with no checked head pass in the classification,
    base source reads at admission, or dropping current usage, byte
    equality, or the fixed bound. Each one breaks a requirement that stays.
    C keeps one checked pass, and E and F keep the checked read, so no option
    conflicts with this line.
  - Incremental `render_all` validation. It is not proof work. It also
    breaks checked head validation, because in Serve the `render_all` pass
    is the only complete head validation of a classification.
  - Proof records kept across Serve processes. The reuse rules allow only
    in-memory retention in one Serve process.
  - Watcher events or edited-file lists in place of a proof. The decision in
    "Proven view reuse" rejects them, because they cannot prove that the
    output stays equal.
  - A head document identity from its recipe key alone, without its byte
    digest. It breaks the complete content proof, because the composed
    document is an input, and its recipe key is not its content digest.
  - A larger render cache, so that head views need no restore. It trades
    memory for speed. The comparison serving contract rejects a larger
    render cache, because no fixed cache bound fits every catalogue.
  - A faster digest, more workers, an earlier start of the proofs, or a
    cache-friendly proof order. Proofs already run on every comparison
    worker, and an earlier start only moves the same work. The reuse design
    admits views in stream order. By estimate, one SHA-256 for each view is
    small next to five document reads.
- **Assumptions:**
  - The five requirements stay: byte equality, current usage, checked head
    validation, base reads of kept data only, and the fixed memory bound.
    Source: the two reuse protocol pages and the user decisions of
    2026-11-17.
    - "Checked head validation" means that the head goes through the checks
      of its generation in each classification.
    - A separate checked read for each reused view is an implementation call
      of 2026-11-17, not a requirement. C, E, and F change how often or how
      cheaply the checks run. They do not change what the checks test.
  - The checked head read is the main cost of the proof. Source: the two
    nearly equal duration sums. This holds only in part, because
    `currentUsageMs` also times base usage reads and the usage copies of
    compared views. The timing split must check it. A needs no split.
  - Current head usage needs a document read that can restore the tree.
    Source: the code. This is not a requirement. Compact cache entries keep
    the usage and the links outside the compressed payload. F drops this
    assumption, and C depends on it.
  - The proof work is the main part of the 7,787 ms comparison. Nobody
    measured this. The 20,620.890 ms sum adds the work of all worker
    threads. The `render_all` pass, the entry pairing, the ordered consumer,
    and the steps that combine views also run inside the 7,787 ms. The
    timing split must time these phases. A larger phase needs its own item.
- **Wider fix:** C, in its single-path form. It prevents the class only when
  the `render_all` pass and the proof share one checked read for each head
  view, and when C names a usage source that needs no restore or keeps its
  usage record within a fixed bound.
- **Previous examples:** On 2026-11-17 the same branch moved proofs from the
  calling thread to the workers. It also shared one identity table for
  recording and proofs, and it took current head usage from the checked
  read of the proof.
- **Related:** `duplicate-head-closure-walk.md` holds the repeated closure
  walk of `Session::closure_job` in the same graph code. A reused view makes
  no closure read, so that walk is not part of the proof cost.
- **Recommendation:** E, if the timing split shows that the link checks are
  the main part of the checked head read. If the own document read and its
  restore are the main part, choose F. If neither part is, keep A and open a
  new item for the larger phase. The first version of this item recommended
  C. C saves no more than E unless it also solves the usage read, and it
  costs Large effort. C in its single-path form gives the best protection for
  the codebase, as the wider fix says.
- **Action:** ask the user, because the user asked on 2026-11-17 to keep this
  choice open for a later branch, and no option is clearly best until a
  timing split names the main cost. The question waits for that later
  branch. It does not block the reuse pull request.
