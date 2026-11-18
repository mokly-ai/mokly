# mokly-cloud edit comparisons keep an unexplained cost

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the branch
  `calummoore/mokly-comparison-proof-cost-mcnn`. The performance orchestrator
  measured its change on the `mokly-cloud` catalogue and asked for this item.
- **Location:** `crates/mokly-compare/src/comparison.rs:60-101`,
  `crates/mokly-compare/src/comparison_slots.rs:92-118`,
  `crates/mokly-compare/src/comparison_preparation.rs:150-160`,
  `crates/mokly-graph/src/session_render.rs:15-55`,
  `crates/mokly-server/src/comparison_graph.rs:59-72`, and
  `crates/mokly-graph/src/session_proof.rs:37-42`, in `Session::input_identity`.
- **Reason:** The change of the branch that measured this cost shares link
  checks, which leaves this cost unchanged, and no timing split names its main
  part yet.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **mokly-cloud catalogue:** the React catalogue of the `mokly-cloud`
    repository, with 167 entries and 1,508 views.
  - **Proof:** the check that every recorded input of a kept view comparison
    still has the same content identity. A reused view passes it. A compared
    view fails it or has no kept comparison, so Serve compares it in full.
  - **`render.document`:** the timing stage of one document read, opened by
    `Session::raw` at `crates/mokly-graph/src/session_render.rs:15-55`. It
    also opens on a render cache hit, and it records `cache_hit`.
  - **Performance orchestrator:** the coordinating agent of the Changes
    performance work. It holds the design decisions that the user gave it.
- **Background:**
  - The performance orchestrator measured on 2026-11-18:
    - Two release cores: `main` at `bc4f4cc40`, and `2c46ed670`, which shares
      link checks within one head generation.
    - Both cores used the same sidecar distribution, built from `bc4f4cc40`.
    - A machine with four vCPUs and a render pool size of 4.
    - Three interleaved rounds. Each round ran a strict build with
      `--base HEAD`. Then a Serve process ran two edits at line 35 of
      `slug-editor.tsx`. So each side has six edit cycles.
  - Results, as means over the six edit cycles of each side:
    - `review.compare-views` took 246 ms on both sides.
    - `changes.classify` took 430 ms with `2c46ed670` and 425 ms on `main`.
      So about 180 ms of each classification lies outside
      `review.compare-views`.
    - Each edit reused 1,464 views, compared 44 views, and recorded 29,192
      proof reads.
    - `render.document` reads took 109 to 156 ms of the comparison.
    - The peak resident memory of the core was 851 MiB on `main` and 842 MiB
      with `2c46ed670`.
  - The link-check sharing of `2c46ed670` is neutral on this catalogue.
  - The code, by reading only:
    - `Engine::compare_reusing` at `crates/mokly-compare/src/comparison.rs:60`
      runs the head `render_all` pass at line 67. Then it pairs the entries,
      runs the ordered view stream from line 93, and runs the steps that
      combine views.
    - A worker runs the proof of each admitted view, at
      `crates/mokly-compare/src/comparison_slots.rs:92-118`. A view whose
      proof fails is prepared in full.
    - A compared view reads its base document from the kept capture, or its
      fallback, and its head document through `comparison_document`, at
      `crates/mokly-compare/src/comparison_preparation.rs:150-160`.
    - The proof of a reused view reads its head document through the checked
      head read too. So `render.document` spans come from both kinds of view.
    - A head document identity combines the plan key of the view with the
      digest of its bytes, at
      `crates/mokly-server/src/comparison_graph.rs:59-72` and
      `crates/mokly-graph/src/session_proof.rs:37-42`, in `Session::input_identity`. So a view whose plan
      key changed fails its proof, also when its bytes stayed equal.
  - Requirements that stay:
    - A classification that reuses comparisons publishes the same bytes as a
      full comparison, with the same counts, warnings, and diagnostics.
      Source: View Comparison Reuse in
      `docs/protocol/mokly-comparison-serving.md`.
    - Only a complete content proof allows reuse. A failed read during the
      proof only causes a full comparison. Source: Proven view reuse in
      `docs/protocol/mokly-changes-serving.md`.
    - Each step that combines views runs again over every view, with the
      current usage of both sides. Source: the same section.
    - The kept comparisons share one fixed bound of at most 32 MiB. It is
      separate from the 256 MiB render cache and the 256 MiB base capture.
      Source: `docs/protocol/mokly-comparison-serving.md`.
    - On 2026-11-16 the user asked to keep improving the speed and the
      reliability of Changes, and to merge in several pull requests without
      asking.
    - The same user decision forbids any change that can exhaust a machine's
      memory. The user gave the design decisions of this work to the
      performance orchestrator.
  - Unknowns:
    - Whether the 109 to 156 ms of `render.document` is wall time or a sum
      over threads.
    - How much of that time comes from the 44 compared views, and how much
      from the proof reads of reused views.
    - Which phases fill the about 180 ms of `changes.classify` outside
      `review.compare-views`.
    - How many of the 44 compared views had changed output.
- **Problem:** On the `mokly-cloud` catalogue, each edit still spends a mean of
  246 ms in `review.compare-views` and about 430 ms in `changes.classify`. The
  link-check sharing did not change this, and no split names its main part.
- **Impact if no action:** Edits of a React catalogue keep this cost. A later
  change can target a phase that is not the main cost.
- **Root question:** How can Serve shorten the edit classification of a React
  catalogue such as `mokly-cloud`, with the same output, current usage,
  checked head validation, retained-only base reads, and fixed memory bounds?
- **Options:**
  - **A.** Change nothing. Each edit keeps about 246 ms of comparison and
    430 ms of classification on this catalogue. Effort: Small.
  - **B.** Profile first, in a later branch, with a temporary probe.
    - Split `review.compare-views` into the proofs of reused views, the full
      preparation of compared views, the ordered consumer, and the steps that
      combine views.
    - Inside the compared views, split document reads, cache hits, sidecar
      render waits, closures, and resource and stylesheet work.
    - Split the part of `changes.classify` outside `review.compare-views`.
    - Count the compared views whose head bytes stayed equal.
    - Run it with the setup above on `mokly-cloud`. Also run the React
      variant of the large fixture of `tests/fixtures/large/README.md`, for a
      shape that the repository can reproduce.
    - Keep the probe and its results out of the repository, and add no test.
      Then record the split in this item, and recommend the option for the
      largest measured part.
    - Cost: one measurement and no product change. Effort: Medium.
  - **C.** Add permanent sub-stages inside `review.compare-views` for the
    proofs, the compared views, the ordered consumer, and the steps that
    combine views. Cost: more timing records for each classification. The
    timings contract needs no change, because stage names are diagnostic
    details. Effort: Small.
  - **D.** Share work that several compared views repeat in one
    classification, such as document, closure, or stylesheet work. Cost: it
    helps only when the split shows such repetition, and each view keeps its
    own output within the fixed bounds. Effort: Medium.
  - **E.** Let a proof accept a head document whose plan key changed while
    its bytes and its comparison evidence stayed equal. Risk: a missed input
    would publish stale output, so the design needs a review against the
    complete content proof. Effort: Large.
- **Left out:**
  - More workers, or an earlier start of proofs or compared views. They move
    the same work and remove none of it.
  - A larger render cache. It breaks the fixed memory bounds.
  - Watcher events or edited-file lists in place of a proof. The Proven view
    reuse decision rejects them, because they cannot prove that the output
    stays equal.
  - Reuse of the final result of an entry or of the catalogue. The same
    section rejects it, because attribution and impact must read the current
    evidence of every view.
- **Assumptions:**
  - The requirements above stay. Source: the two protocol pages and the user
    decision of 2026-11-16. Every option keeps them.
  - Most of the cost lies in the 44 compared views. Source: the
    `render.document` time. This holds only in part, because proof reads open
    the same stage. B checks it.
  - One machine with four vCPUs shows the cost. Source: the measurement of
    2026-11-18. B repeats it and adds the React fixture.
- **Wider fix:** C. It keeps the phases of each later comparison visible, so a
  cost of this kind always has a split.
- **Previous examples:**
  - On 2026-11-18 the work on cheaper comparison proofs ran a one-time timing
    split before it chose an option. The split showed that link checks took
    88.1% of the measured proof work on the large HTML fixture.
  - [head-graph-preparation-cost.md](./head-graph-preparation-cost.md) asks
    for the same split before it chooses a fix for graph preparation.
- **Related:** [head-graph-preparation-cost.md](./head-graph-preparation-cost.md)
  covers graph preparation in the edits of the large HTML fixture, which runs
  before the comparison. This item covers the classification of a React
  catalogue.
- **Recommendation:** B. No option is clearly best until a split names the
  main part, and B names it without a product change. C best keeps later
  costs measurable.
- **Action:** fix after merge, apply B, because the change that measured this
  cost leaves it unchanged, and the split must come before a choice among C,
  D, and E.
