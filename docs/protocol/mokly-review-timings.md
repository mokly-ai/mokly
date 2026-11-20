# Review Timing Records

These records use the schema and privacy rules in
[startup diagnostics](./mokly-timings.md#opt-in-timings). The
[core span table](./mokly-timings.md#core-spans) names each `review.*` stage
and what it measures.

Review spans use the same session, role, and parent context as their caller:
under `changes.classify` in Serve and under `output.write` in `build`. The
`review.capture-side` span carries `side`, with `base` for the base generation
and `head` for the head generation. Build and publish emit the head capture
under `output.write` before `changes.classify`. The base capture appears under
`review.base-tree`. `review.base-tree` carries `action`: `prepare` for a new
base, and `reuse` when Serve reuses the kept base of the
[base lifetime rule](./mokly-base-preparation.md#serve-base-lifetime). A
reuse emits no `review.base-extraction`, `review.base-dependencies`, or
`review.capture-side` span. A repeated discovery for the same side, route, content
digest, and exclusion identity is a defect. A contained parse or selector failure in
`review.css-analysis` returns unresolved evidence with status `ok`; an
escaping error ends the span with `error`. The spans log no paths,
selectors, CSS, or document text.

Dependency `tier` is numeric: 1 for working dependencies, 2 for the base
installation, and 3 for fallback. A successful fallback has status `ok`.
Comparison counts cover the final view and document union. `changed` includes
added and removed views; `unchanged` and `ignoredOnly` are separate totals.
Only a completed comparison emits these counts. `review.base-extraction`,
`review.base-dependencies`, and `review.compare-views` start with error status and
record `ok` only after successful work. A `review.base-extraction` lookup
without a build that finds no complete entry ends without an `action`.

In Serve, `build`, and `publish`, the `counts` and `end` records of
`review.compare-views` also carry `admittedViews`. It counts the compared
views that the comparison prepared from one document, after it proved equal
bytes and equal comparison metadata on both sides. Reused views do not count.

Only in Serve, `review.compare-views` also records the work of
[view comparison reuse](./mokly-comparison-serving.md#view-comparison-reuse).
Its `end` record carries the fields below, also with status `error`, and so
does its `counts` record. Comparison counts include reused views.

- `reused` counts reused views, and `compared` counts compared views.
  `recordedReads` counts their proof reads, kept or newly recorded.
- `identitiesChecked` counts the identity checks of the proofs.
  `identityReads` counts the checks that asked a generation for an identity.
  `recordingIdentityReads` counts the identity reads of recording.
- `revalidationMs`, `recordingMs`, and `currentUsageMs` give the time of the
  proofs, of recording, and of current usage reads, in decimal milliseconds.
  Each sums the calls of all threads, so it can exceed `durationMs`. A proof's
  checked head read also gives current usage, so its time counts in both
  `revalidationMs` and `currentUsageMs`. Do not add these sums.
- `acceptedBytes` is the charge of the previously accepted comparisons, or
  zero. `candidateViews` and `candidateBytes` give the comparisons collected
  before any overflow and their logical charge, which can count shared
  evidence more than once. `retainedBytes` is the whole charge at the end,
  including attempts that still drain. `peakBytes` is the highest whole
  charge since Serve started. These charges are estimates, not measured RSS.
- `overflowed` is a boolean. It is `true` when the classification could not
  collect a complete set within the bound.

Decision: Serve reports the cost of proofs, recording, and usage reads.
Reuse counts alone were rejected, because they would hide the cost of proofs.

`review.capture-side` starts with status `error` and records `ok` only after
successful work. Completed captures emit counts, including a zero-view capture
when no input fits. `views` counts retained documents on `side`.
`uncapturedViews` counts documents that use that side's source fallback. These
counts sum to the number of documents on that side, including on reuse.
`encodedBytes` counts compressed document and CSS payloads. `retainedBytes` adds
the capture's metadata, closures, generated digests, route keys, and
conservative container charges. Each side has a separate 256 MiB capture bound
beside the render cache. These charges are not measured RSS. Serve can hold an
accepted capture while building its replacement.
