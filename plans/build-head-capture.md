# Build Head Capture

Status: Active. On branch `calummoore/change-detection-performance`, no pull
request yet. The plan closes when its PR merges.

`build` and `publish` render every head document five times: the build
check, the Changes pre-render, the Changes entry loop, the output loop, and
the comparison output. The last three render one document at a time on one
render worker. The 256 MiB render cache cannot hold a large catalogue from one
pass to the next, so each pass renders almost every document again. On
`main` at `a8c7f2b2`, measured on 2026-10-26 with a release binary on an
eight-CPU machine, the large React fixture (1,620 routes, 5,850 documents,
2 sidecars) built in 1,057 s. The four repeated head passes took 725 s of
render time and made about 23,100 sidecar calls. The base side has no such
problem: Changes renders each base document once and keeps a compressed copy,
the base capture, which later reads restore without a render.

This plan captures the head the same way, once, during the build check.
Changes, the output loop, and the comparison output then restore head
documents from that copy. The build stage order does not change. Serve is not
covered: its current side changes with each edit, so it needs its own capture
design, and its background pass renders one document at a time and needs
bounded batches instead. The per-file Git process in the base copy (review
finding 2 of 2026-10-26) and the missing base copy timing span (finding 3)
are separate work.

Decision 1 (2026-10-26): capture the head once, option D of review finding 1.
Rejected: A, raise the render cache limit, because its memory cost was not
measured, a larger catalogue exceeds any fixed limit again, and it does not
help Serve. Rejected: B, render each loop in bounded batches, because the
documents still render five times and the gain on React catalogues is capped
by the sidecar count. Rejected: C, render once and pass the documents through
a reordered build pipeline, because it changes the stage order. Reason: D
reuses the tested base capture and removes an estimated 12 of the 18 minutes
of a large React build. Serve's background pass keeps B as a follow-up.

Decision 2 (2026-10-27): the head capture has its own 256 MiB bound, option
A, the same value as the base bound. Both captures together can hold up to
512 MiB beside the 256 MiB render cache. Rejected: B, one 256 MiB bound shared
by both sides, because the head is captured first, so a large head can leave
no room for the base. Reason: the base capture keeps its behaviour, and the
React fixture needs about 86 MB per side.

The 2026-10-26 baseline records and method are under `.context/measure/` on
the measuring machine. New evidence goes under `.context/build-head-capture/`.

Contract owners:

- [Runtime contract](../docs/protocol/mokly-runtime.md), render graph and
  cache, and build.
- [Render graph and cache contract](../docs/protocol/mokly-render-cache.md),
  render graph, render cache, side captures, and both decisions.
- [Timings contract](../docs/protocol/mokly-timings.md), `review.capture-side`.
- [Components contract](../docs/protocol/mokly-components.md), rendering and
  read model.
- The [mokly-compare README](../crates/mokly-compare/README.md), the
  [mokly-cli README](../crates/mokly-cli/README.md), and the
  [mokly-graph README](../crates/mokly-graph/README.md).

## Milestone 1: Documentation and protocol

State the head capture requirement and the decisions in force, so that the
review can check the code against them.

- [x] Update the render graph and cache section of
      `docs/protocol/mokly-runtime.md`: `build` and `publish` capture the head
      once during the build check, within the head capture bound that
      decision 2 sets. Changes, the output, and the comparison output read
      the head capture. A head document that does not fit renders again on
      the head root. Serve keeps reading the head from the render cache.
      Record decision 1 next to the rule: the rejected alternatives and the
      reason, in one or two sentences.
- [x] Update the build section of `docs/protocol/mokly-runtime.md`: a build
      renders every view once and keeps the captured documents for Changes
      and for the output.
- [x] Update `docs/protocol/mokly-timings.md`: `review.capture-side` carries
      `side`, `base` or `head`. `build` and `publish` emit the head capture
      under `output.write` before `changes.classify`. The counts describe the
      documents of that side. Each side has its own capture bound under
      decision 2, beside the render cache.
- [x] Update `docs/protocol/mokly-components.md`: Serve reads every document
      from the render cache; `build` reads the head capture under the runtime
      contract.
- [x] Confirm that the build sections of
      `docs/protocol/mokly-comparison-serving.md` and
      `docs/protocol/mokly-export.md` stay true. Change nothing that stays
      true.
- [x] Update `crates/mokly-compare/README.md`: the capture serves both sides,
      the head bound constant, and the head capture entry point under
      `### Key Code`. Remove the sentence that head reads use the render cache
      and render again after eviction, which stays true only in Serve.
- [x] Update `crates/mokly-cli/README.md`: the build check captures the head,
      and the capture spans cover both sides.
- [x] Update `crates/mokly-graph/README.md`: production callers capture the
      head in `build` too, and the comparison engine receives a captured head.
- [x] Write the answer to decision 2 into the runtime contract.

Evidence: `.context/build-head-capture/milestone-1-2.md`.

## Milestone 2: Head capture in the build check

Replace the build check's render pass with a bounded capture of the head and
route every later head read through it. The build output does not change.

- [x] Add a side parameter, base or head, to the capture entry point in
      `crates/mokly-compare/src/comparison_capture.rs`. Record it as the
      `side` field of the `review.capture-side` span. Add the head bound
      constant in `crates/mokly-compare/src/capture_weight.rs` with the value
      from decision 2.
- [x] Add `capture_head` beside `capture_base` on the `Comparison` trait in
      `crates/mokly-compare/src/comparison_types.rs`, and expose it to the
      build through the `ChangesService` trait in
      `crates/mokly-compare/src/base_render.rs`.
- [x] In `crates/mokly-cli/src/build_prepare.rs`, replace the `render_all`
      call with the head capture. Keep the captured generation as the build's
      generation. Read the render summary from it, which renders nothing when
      the capture fit. A capture that does not fit falls back to the source,
      which renders as today. Map capture errors to the existing rendering
      error with the preparation warnings.
- [x] Update the doc comments that say head reads use the render cache, such
      as `after` in `crates/mokly-compare/src/comparison_types.rs`.
- [x] Confirm that a restored head document carries everything the output
      loop and the inspector injection need: bytes, tree, links, usage,
      warnings, resources, and markers.
- [x] Rust tests in `crates/mokly-cli`:
  - [x] After `prepare`, the generation reports a comparison capture whose
        view count equals the document count, and a later `render` returns
        the same bytes as the source without another source render.
  - [x] A bound too small for the summary falls back to the source, and the
        build keeps the same warnings and document count.
  - [x] A build emits two `review.capture-side` groups: `head` under
        `output.write` before `changes.classify`, and `base` under
        `review.base-tree`. Update `_tests_/capture_trace_tests.rs`, which
        indexes the records by position.
- [x] Rust tests in `crates/mokly-compare`: add the side to the existing
      capture tests, and assert the `side` field on the span.
- [x] Node tests: filter `tests/static_capture_timing.test.ts` by side and
      assert the head group too. Add `side` to `tests/helpers/static_timings.ts`.
- [x] Run the existing build warning tests. They must pass unchanged.

Evidence: `.context/build-head-capture/milestone-1-2.md`.

- [x] Restore the runtime capture requirements and split the runtime contract
      when the restored text exceeds its protocol page cap.
- [x] Align architecture and protocol docs that described build head reads as
      render-cache reads.

## Milestone 3: Output check and measurement

Prove that the output is unchanged and record the new times.

- [x] Run `npm run build`, then build `examples/basic` with `--strict --base`
      into `.context/build-head-capture/example`. Build the same catalogue
      with a binary from `origin/main` into a second directory. Compare the
      two directories byte for byte. Record the result and any differing file
      with its reason in `.context/build-head-capture/output-diff.txt`.
- [x] Smoke test: serve the built output as plain files, then open a screen,
      its Changes marks, and one comparison pane in the browser. Save a
      screenshot under `.context/build-head-capture/`.
- [x] Measure with the release binary on `examples/basic` and on the large
      HTML and React fixtures, with the 2026-10-26 method: build time,
      `changes.classify`, sidecar calls per pass, and peak memory. Save the
      records under `.context/build-head-capture/`. Add one line per
      catalogue below.
  - `examples/basic`: 112.128 s build versus 219.520 s baseline, 92.299 s
    Changes versus 148.090 s, one head capture versus four repeated head
    passes, 601 versus 2,937 head fragment calls, and 4,685,028 versus
    3,514,732 KiB total peak.
  - `large HTML`: 44.091 s build versus 166.157 s baseline, 21.486 s Changes
    versus 77.501 s, one head capture versus repeated head passes, 0 versus 0
    sidecar calls, and 1,135,432 versus 1,339,904 KiB total peak.
  - `large React`: 177.040 s build versus 1,056.519 s baseline, 89.611 s
    Changes versus 445.383 s, one head capture versus four repeated head
    passes, 5,790 versus about 23,100 head fragment calls, and 2,189,636 versus
    2,120,160 KiB total peak.
  - Memory check: direct core peaks were 581,616/585,804 KiB new versus
    688,340/694,160 KiB baseline; sidecar sums were 2,203,200/2,200,656 KiB
    new versus 2,005,456/2,111,516 KiB baseline. The new core peak was lower.

Evidence: `.context/build-head-capture/output-diff.txt`,
`.context/build-head-capture/smoke.png`, and
`.context/build-head-capture/measurement-summary.md`.

## Milestone 4: Verification, commit, review, and pull request

- [x] Run the targeted tests: `cargo test -p mokly-compare`,
      `cargo test -p mokly-cli`,
      `npm test -- tests/static_capture_timing.test.ts`,
      `npm test -- tests/markdown_links.test.ts`, and `npm run format:check`.
- [x] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [x] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - [ ] 1. No test guards the render-once requirement. Severity Low, effort
        Small. Recommended: A, assert in
        `tests/static_capture_timing.test.ts` that every core
        `render.document` record has a `review.capture-side` ancestor.
  - [ ] Outside the scope: `docs/protocol/*.md` and `AGENTS.md`. Most pages
        still carry the completed-plan status line. Separate branch.
  - [ ] Outside the scope: `docs/protocol/mokly-timings.md:219`. The render
        cache budget row links to capture bounds without a render-cache byte
        bound. Separate branch.
  - [ ] Outside the scope: `docs/architecture/rust-core.md:170`. The
        architecture page names a code constant instead of only a component.
        Separate branch.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
