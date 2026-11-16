# Compact evicted documents in the render cache

Status: Active. On branch `calummoore/compact-evicted-documents`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Serve, `build`, and Changes read rendered documents from one render cache, an
LRU with a 256 MiB bound. When a catalogue's documents need more than the
bound, every pass over all views evicts the entries that the next pass needs,
so almost every lookup misses. On the `mokly-cloud` catalogue, 1,508 views,
each classification renders about 3,000 views again: the base capture renders
every base view, although cross-side render keys are equal, and Serve's
comparison renders the head views again. A light-only copy of that catalogue
fits in the cache, and its base capture missed 48 of 906 lookups. The
measurements are in `.context/compact-evicted-documents/`.

The change keeps an evicted document in a compact tier of the render cache
instead of dropping it. The compact tier holds the document in the lossless
encoding that the comparison capture already uses. A lookup that misses the
full tier restores the document from the compact tier. Fragments and
stylesheets leave the cache on eviction, as before. The total bound stays
256 MiB. The change does not cover a disk tier, render keys, or the capture's
own copies.

Decisions:

- 2026-11-16, user: keep optimising the speed and the reliability of Changes,
  merge without asking, and make no change that can exhaust a machine's
  memory. This approves the plan, its protocol changes, and the merge.
- 2026-11-16, my call: a compact tier for evicted documents. Rejected: a
  larger bound, because memory grows and a larger catalogue still thrashes. A
  scan-resistant eviction order, because part of the head still misses when
  the head alone exceeds the bound. A head capture in Serve that the base
  reads, because it serves only the Changes readers and adds a copy, while the
  compact tier serves every reader within the same bound. A disk tier, for a
  later change, because it needs a stored format.
- 2026-11-16, my call, changed after the options check of the same day: one
  256 MiB total for both tiers. The full tier may use all of it. The compact
  tier grows only by taking room from evicted full entries, up to a ceiling of
  128 MiB, so the full tier keeps at least 128 MiB. A catalogue that fits in
  256 MiB today keeps every artifact full. The first call was a fixed split of
  192 MiB and 64 MiB. Rejected, because it takes room from a catalogue that
  fits today. The ceiling is 128 MiB, because a CSS-only edit on `mokly-cloud`
  needs about 3,016 documents, about 85 MB in compact form.
- 2026-11-16, my call: the full tier encodes a document when it evicts it, not
  when it stores it. Each artifact then lives in one tier and counts once
  against the bound, and a document that is never evicted costs no encoding.
  The encoding runs outside the cache locks.
- 2026-11-16, my call, changed after the options check of the same day: a
  compact hit promotes the entry to the full tier only when the same key was
  restored before within the full tier's turnover, that is, within fewer cache
  operations than the full tier has entries. An insert of a key that the
  compact tier holds keeps the entry compact. A single pass over all views then
  never promotes, and a document that readers read again stops paying a
  restore. The first call kept every restored document compact. The check
  found that four callers insert the artifact again after each read, which
  promoted every hit, and that a repeated reader would pay a restore each time.
- 2026-11-16, my call: a compact entry that fails to restore counts as a miss
  and leaves the cache, so the caller renders again. No cache path panics.
  After the options check of the same day: the failure also counts as
  `restoreFailures` in the `render.cache` record and logs an error without
  document data, so a codec defect stays visible. A capture view whose restore
  fails reads its side's source, as an uncaptured view does.
- 2026-11-16, my call after review round 1, finding 1: documents on their way
  to the compact tier stay inside the bound. A fixed headroom of 1/16 of the
  total holds them, and the full tier never uses it. Each released document
  reserves its charge plus twice that charge for the encoding work. A document
  whose reservation does not fit leaves the cache, as before this change, and
  inserts never wait. A lookup also reads the documents in transit. Rejected:
  shared charge ownership without a rule for a full headroom, and a wait of the
  inserting worker. The headroom sits inside the 256 MiB, so memory does not
  grow.
- 2026-11-16, my call: the codec moves from `mokly-compare` to `mokly-graph`,
  beside the cache, so that the cache and the capture share one codec.
- 2026-11-16, docs call: the capture bounds, "Base capture misses use the
  pinned source", the head-capture reader sentence, and the two capture
  decisions moved from `mokly-runtime.md` to "Base And Head Capture" in
  `mokly-comparison-serving.md`, which defines captures, so that the runtime
  page stays within its 250-line cap. The runtime page keeps a link.

Contract owners:

- [Runtime](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- [Timings](../docs/protocol/mokly-timings.md), the `render.cache` counts.
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
- The [mokly-graph README](../crates/mokly-graph/README.md) and the
  [mokly-compare README](../crates/mokly-compare/README.md).
- [Rust core architecture](../docs/architecture/rust-core.md).

## Milestone 1: Documentation and protocol

Depends on: none

State the compact tier, its bound, and its counts in the contract owners.

- [x] `docs/protocol/mokly-runtime.md`: the render cache keeps evicted
      documents in compact form, with 192 MiB of full artifacts and 64 MiB of
      compact documents in one 256 MiB bound. A restore gives the same bytes
      and annotations. Record the decision and the rejected options.
- [x] `docs/protocol/mokly-timings.md`: the `render.cache` record. `hits`
      counts lookups that either tier served, `restores` counts lookups that
      the compact tier served, `misses` counts lookups that no tier served,
      and `evictions` counts entries that left the cache. `chargedBytes` and
      `entries` cover both tiers.
- [x] `docs/protocol/mokly-comparison-serving.md`: a view that a capture
      does not keep renders again only when neither cache tier holds it.
- [x] The `mokly-graph` and `mokly-compare` READMEs: the tiers, the codec's
      new home, and the counts.

## Milestone 2: Compact tier

Depends on: none

Add the compact tier to the render cache and share the codec with the capture.

- [x] Move the lossless document codec, `EncodedView` with its tree and
      annotation records, from `mokly-compare` into `mokly-graph`. The
      capture uses it from there. Restore returns a `Result` instead of
      panicking.
- [x] Give `MemoryCache` a compact tier with its own LRU order and bound.
      Eviction from the full tier encodes a document artifact into the
      compact tier, and drops any other artifact. Eviction from the compact
      tier drops the entry. The encoding runs outside the locks.
- [x] A lookup checks the full tier, then the compact tier. A compact hit
      returns the restored artifact and promotes the entry only on reuse
      within the full tier's turnover. An insert of a compact-held key keeps
      it compact. A failed restore removes the entry, counts as a miss and as
      a restore failure, and logs an error.
- [x] `CacheStats` gains the restore and restore-failure counts. The
      `render.cache` timing record writes them as `restores` and
      `restoreFailures`. Hits, misses, evictions, charged bytes, and entries
      follow Milestone 1.
- [x] A capture view whose restore fails reads its side's source.
- [x] Construct the render cache with the 256 MiB total and the 128 MiB
      compact ceiling in `crates/mokly-cli/src/render_runtime.rs`.
- [x] Unit tests with small bounds: an evicted document restores with equal
      bytes and tree; a fragment or a stylesheet leaves on eviction; the
      compact tier evicts its least recently used entry; the total and the
      ceiling hold; a catalogue that fits keeps every artifact full; a single
      pass never promotes and a repeated read does; an insert of a
      compact-held key keeps it compact; the counts; a failed restore is a
      miss; the capture fallback.
- [x] One test above the cache, at the lowest level that fails without the
      change: a base capture whose render keys equal the head's makes no
      render after the head overflowed the full tier.

## Milestone 5: Documentation after the options check

Depends on: 1

State the design calls that the options check changed.

- [x] `docs/protocol/mokly-runtime.md`, `docs/protocol/mokly-timings.md`,
      and the two READMEs: the shared 256 MiB total with the 128 MiB compact
      ceiling, promotion on reuse, the `restoreFailures` count, and the
      capture fallback.
- [x] `docs/architecture/rust-core.md`: the render cache description in
      "Render Graph" and "Memory Bounds".
- [x] `docs/protocol/mokly-on-demand.md`: a finished document renders again
      only after it leaves the render cache.

## Milestone 3: Measurement

Depends on: 2

Measure the change against `main` on `mokly-cloud` and `examples/basic`.

- [x] Release build. On `mokly-cloud`, a build with Changes and a Serve run
      with two edits, before and after. Record the times, the `render.cache`
      counts, and the peak memory under `.context/compact-evicted-documents/`.
- [x] On `mokly-cloud`, a Serve run with one CSS-only edit, the case nearest
      the capacity of both tiers.
- [x] Measure the restore time per document.
- [x] On `examples/basic`, the same runs, to check that a catalogue that
      already fits gets no slower.
- [x] Peak memory does not rise by more than 5% on either catalogue.
- Evidence: `.context/compact-evicted-documents/measurements.md`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 5

- [ ] Run the targeted tests, the early check, and the complete gate named
      in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
