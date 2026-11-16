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
- 2026-11-16, my call: the bound splits into 192 MiB of full artifacts and
  64 MiB of compact documents, so memory does not grow. At about 28 KB for each
  compact `mokly-cloud` document, the compact tier holds about 2,300 documents.
  Milestone 3 measures the split. A change of the split keeps the 256 MiB total.
- 2026-11-16, my call: the full tier encodes a document when it evicts it, not
  when it stores it. Each artifact then lives in one tier and counts once
  against the bound, and a document that is never evicted costs no encoding.
  The encoding runs outside the cache locks.
- 2026-11-16, my call: a restored document stays in the compact tier. A full
  pass over all views then does not push recent full artifacts out.
- 2026-11-16, my call: a compact entry that fails to restore counts as a miss
  and leaves the cache, so the caller renders again. No cache path panics.
- 2026-11-16, my call: the codec moves from `mokly-compare` to `mokly-graph`,
  beside the cache, so that the cache and the capture share one codec.

Contract owners:

- [Runtime](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- [Timings](../docs/protocol/mokly-timings.md), the `render.cache` counts.
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
- The [mokly-graph README](../crates/mokly-graph/README.md) and the
  [mokly-compare README](../crates/mokly-compare/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

State the compact tier, its bound, and its counts in the contract owners.

- [ ] `docs/protocol/mokly-runtime.md`: the render cache keeps evicted
      documents in compact form, with 192 MiB of full artifacts and 64 MiB of
      compact documents in one 256 MiB bound. A restore gives the same bytes
      and annotations. Record the decision and the rejected options.
- [ ] `docs/protocol/mokly-timings.md`: the `render.cache` record. `hits`
      counts lookups that either tier served, `restores` counts lookups that
      the compact tier served, `misses` counts lookups that no tier served,
      and `evictions` counts entries that left the cache. `chargedBytes` and
      `entries` cover both tiers.
- [ ] `docs/protocol/mokly-comparison-serving.md`: a view that a capture
      does not keep renders again only when neither cache tier holds it.
- [ ] The `mokly-graph` and `mokly-compare` READMEs: the tiers, the codec's
      new home, and the counts.

## Milestone 2: Compact tier

Depends on: none

Add the compact tier to the render cache and share the codec with the capture.

- [ ] Move the lossless document codec, `EncodedView` with its tree and
      annotation records, from `mokly-compare` into `mokly-graph`. The
      capture uses it from there. Restore returns a `Result` instead of
      panicking.
- [ ] Give `MemoryCache` a compact tier with its own LRU order and bound.
      Eviction from the full tier encodes a document artifact into the
      compact tier, and drops any other artifact. Eviction from the compact
      tier drops the entry. The encoding runs outside the locks.
- [ ] A lookup checks the full tier, then the compact tier. A compact hit
      returns the restored artifact and keeps the entry compact. A failed
      restore removes the entry and counts as a miss.
- [ ] `CacheStats` gains the restore count. The `render.cache` timing record
      writes it as `restores`. Hits, misses, evictions, charged bytes, and
      entries follow Milestone 1.
- [ ] Construct the render cache with the 192 MiB and 64 MiB bounds in
      `crates/mokly-cli/src/render_runtime.rs`.
- [ ] Unit tests with small bounds: an evicted document restores with equal
      bytes and tree; a fragment or a stylesheet leaves on eviction; the
      compact tier evicts its least recently used entry; neither tier passes
      its bound; the counts; a failed restore is a miss.
- [ ] One test above the cache, at the lowest level that fails without the
      change: a base capture whose render keys equal the head's makes no
      render after the head overflowed the full tier.

## Milestone 3: Measurement

Depends on: 2

Measure the change against `main` on `mokly-cloud` and `examples/basic`.

- [ ] Release build. On `mokly-cloud`, a build with Changes and a Serve run
      with two edits, before and after. Record the times, the `render.cache`
      counts, and the peak memory under `.context/compact-evicted-documents/`.
- [ ] On `examples/basic`, the same runs, to check that a catalogue that
      already fits gets no slower.
- [ ] Peak memory does not rise by more than 5% on either catalogue.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 1, 2, 3

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
