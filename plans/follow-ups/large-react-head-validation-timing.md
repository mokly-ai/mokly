# Large React edits with head validation facts are unmeasured

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-edit-comparison-cost-bo07`, an unchecked acceptance task
  of its plan. The computer that ran the measurements failed before the large
  React timing pairs ran.
- **Location:** `crates/mokly-compare/src/validation_head.rs`,
  `crates/mokly-compare/src/reuse_optional.rs`,
  `crates/mokly-compare/src/comparison_reuse.rs:120` to line 170, the
  `review.compare-views` span and its fact fields, and
  `tests/fixtures/large/README.md`.
- **Reason:** The change merged on the official `mokly-cloud` and Basic
  results, and the large React check needs a long local run that did not
  complete.

- **Terms:**
  - **Validation facts:** the closure files, the ordered closure warnings,
    the lexical observer paths, and the walk reads of one head view. Serve
    keeps them after a classification. `src/validation_head.rs` in
    `crates/mokly-compare` reuses them only after a complete content proof.
  - **Large fixture:** the generated HTML and React catalogues of
    `tests/fixtures/large/README.md`. The default dimensions give 1,620 routes
    and 5,850 documents.
  - **Comparison bound:** the fixed 32 MiB bound that kept comparisons and
    the optional fact store share, from
    `docs/protocol/mokly-comparison-serving.md`. Facts never displace a kept
    comparison.
- **Background:**
  - The change lets a Serve edit reuse the validation facts of a head view
    instead of a new closure walk. Every ordered and global check and every
    comparison step that combines views still runs.
  - The acceptance criteria of the change, set by the performance
    orchestrator on 2026-11-21:
    - At least 60 ms less mean warm edit time on `mokly-cloud`.
    - No regression beyond noise on Basic and on the large React fixture.
    - The whole-tree peak of cold ten-edit sessions within 2% of `main`.
  - The official results on `mokly-cloud` and Basic met these criteria. For
    example, warm `mokly-cloud` edits went from 2.10 to 1.97 s.
  - Large HTML, three local rounds at the default dimensions: Ready went
    from 2.82 to 2.46 s, and the comparison went from 561 to 338 ms. The
    fact peak was 16.07 MiB.
  - The large React timing pairs did not run. So no result shows the edit
    time, the fact peak, or the kept comparison bytes on the large React
    fixture.
  - When space in the bound is tight, the bound clears facts first. Then
    the next edit walks again. Nobody measured how often this happens on
    the large React fixture. This is a concern, not a result.
  - The `review.compare-views` span records `validation_fact_bytes`,
    `validation_fact_peak_bytes`, `comparison_kept_bytes`,
    `validation_reused`, `validation_walks`, and `validation_documents`.
    Serve writes them with `--debug-timings` as `validationFactBytes`,
    `validationFactPeakBytes`, `comparisonKeptBytes`, `validationReused`,
    `validationWalks`, and `validationDocuments`.
- **Task:**
  1. Build two native cores and distributions with one profile: `main`
     before the merge of this change, and `main` with it. Record each commit.
  2. Generate the default large React fixture with
     `npm run fixture:large -- --variant react --root .context/large-react`.
  3. Run at least four interleaved pairs of warm edits with
     `npm run benchmark:large -- --root .context/large-react --scenario watch`
     The harness starts Serve with `--debug-timings`, in
     `scripts/large/benchmark.ts`.
  4. For each edit, record the edit time, `review.compare-views`,
     `changes.classify`, and the six fact fields above.
  5. Compare `comparisonKeptBytes` with and without facts. Report whether
     facts ever made the bound refuse or drop a comparison.
  6. Repeat the fact peak record on the default large HTML fixture, for one
     result per variant from the same machine.
- **Impact if no action:** A slowdown or a fact store that does not fit the
  bound on large React catalogues can stay hidden.
- **Needs:** A machine that can run the default large React fixture, and two
  native builds of one profile.
- **Done when:** A report gives the large React edit time of both cores, the
  fact peak, and the kept bytes with and without facts. Then one of these is
  true:
  - The edit time does not regress beyond noise and facts drop no
    comparison. Delete this item.
  - A regression shows. Replace this item with a fix item that gives the
    measured split.
