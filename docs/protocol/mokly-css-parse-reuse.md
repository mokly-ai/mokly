# CSS Parse Reuse

## Delivery Status

Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
not yet implemented: [M3](../../plans/scalable-inline-style-analysis.md#milestone-3-bounded-memory)
delivers the whole-input cache; [M4](../../plans/scalable-inline-style-analysis.md#milestone-4-rule-segment-parse-reuse)
delivers segmentation, its cache and derived rule data; [M5](../../plans/scalable-inline-style-analysis.md#milestone-5-changed-segment-analysis)
delivers cancellation, matched-copy reference pairing and composition.
Until then the delivered whole-element parser and rule diff remain authoritative.

This document owns parsing reuse and rule identity for linked CSS and
[component-aware inline analysis](./mokly-inline-styles.md). The latter alone
uses segment cancellation. Attribution and the closed keep list remain owned
by the inline and [CSS attribution](./mokly-css-attribution.md) contracts.

## Cache Lifetime And Accounting

One classification owns two independent LRU caches, shared across its views,
paths and sides, and discarded when classification ends:

- The **whole-input cache** keys the exact supplied stylesheet-file text (or
  whole-element fallback text) to its complete parse result, including failures.
- The **segment cache** keys normalized segment text, defined below, to a
  verified flat rule run with local ordinals and stored derived data. It never
  caches a partially verified batch or a context-dependent segment.

Each bound is **64 MiB = 67,108,864 estimated bytes**, not a rule count or
an actual-heap promise. An entry costs `64 + 96 * ruleCount + 2 * stringUnits`:
`stringUnits` sums UTF-16 code units in the key and every retained string slot,
including declarations, selectors, conditions, keys, canonical text, references
and retained error data. Count repeated slots even if their strings share
storage; count the key once. The estimate is computed on insertion only;
entries are immutable. Opaque error payloads that cannot be safely measured
and detached from input are used for the request without being cached.

Every retained key and source-derived string is an independent flat copy with
identical code units, not a slice keeping a larger stylesheet or HTML alive.
The cached run never retains a document, element, batch source or absolute
location. On hit move the entry to most-recent; on insertion evict least-recent
entries until the new entry fits. Replace an existing key without double
accounting. An entry exceeding the bound is used for this request but not
retained and does not evict useful entries. A zero test bound retains nothing.
Eviction changes only time: recomputation returns the same result and failures.

## Segment Scanner

Normalize exactly as the whole parser: remove one leading U+FEFF, replace
CRLF, CR and form feed with LF. Scan UTF-16 code units once, with the boundary
semantics of `tokenizeCss`, not a CSS validator:

- Skip ASCII CSS whitespace and complete `/* ... */` comments between rules.
- Quoted strings consume escapes and their closing quote; a backslash escape
  consumes up to six hex digits and its optional following whitespace, or one
  escaped code unit. Escapes cannot introduce a structural bracket.
- Recognize escaped identifiers and unquoted `url(` as the tokenizer does;
  the URL body, including escaped brackets, is opaque until its closing `)`.
  A quoted URL is handled as ordinary parentheses containing a string.
- Maintain typed nesting for `()`, `[]` and `{}`. Brackets inside strings,
  comments, escapes and unquoted URLs have no structural effect.
- Between rules at depth zero, `<!--` (CDO) and `-->` (CDC) are separators,
  not segments. Once a rule begins they remain part of its source.
- A rule begins at its first non-trivia token. It ends at the first top-level
  `;` before any block, or at the `}` closing its first top-level `{`.
  Parentheses/brackets in its prelude cannot end the rule.

The **cache key** is that normalized source from the first token through the
terminating `;` or `}`, inclusive. Surrounding whitespace, comments and
top-level CDO/CDC are excluded; internal trivia is included unchanged. A
trivia-only element has zero segments and a successful empty rule list.
Unterminated comments, strings, escapes or URLs, unclosed or mismatched
brackets, unmatched closings, or trailing non-trivia without a terminator are
scanner anomalies. They request whole-element parsing, not an invented failure.

## Batched Parsing And Verification

Process each style element independently, preserving browser stylesheet
boundaries. Resolve cache hits first. Batch its distinct missing segment texts
in first-occurrence order, separated by LF, with a table of batch start/end
offsets. Duplicate misses within that request reuse the verified run. Invoke
Lightning CSS once before optimization, with the delivered parser's options.
No surrounding-element trivia participates in the batch key or retained run.

Inspect the native top-level source rules, not the number of flattened records:
each segment must have exactly one top-level rule beginning at its recorded
start, wholly within its interval, and ending at its terminator. Every native
top-level rule must be assigned to exactly one segment. Flatten that root's
descendants with the delivered collector; a grouped/nested segment may yield
several records, in depth-first order. Verify each recovered header, body and
local location against the segment, with no declaration run crossing its end.
Cached runs use zero-based local ordinals; assembly copies/rebases them to
unique monotonic ordinals in element order, then document order. Never mutate
the cached run.

Fall back for the **entire element**, discarding that batch's unverified data,
on a scanner anomaly, native parse/serialization failure, missing/extra root,
location/body/terminator mismatch, unsupported collector output, or a parser
that cannot supply the verification data. Also fall back if any top-level
segment's decoded, case-insensitive at-rule name is `charset`, `import` or
`namespace`; their validity/meaning depends on neighboring rules. A native
error in the batch is not itself the element's error: parse the complete
original element through the whole-input path and return that result.

For every element, assembled records must equal the whole-element parse in
order, selectors, declarations, conditions, at-rule/prelude, `block`, custom
property flags and ordinals. Failures, including their side attribution in a
diff, equal the whole-input path; failed parses expose no partial lists.
Differential cases include nested rules, statements/empty blocks, comments,
escapes, CRLF/BOM, CDO/CDC and every fallback. If either side contains a
whole-element fallback, use the full rule-list diff for the pair rather than
partial segment cancellation. Cache reuse may still avoid its parsing cost.

## Stored Rule Data

Compute these once per parsed rule, for both linked and inline paths:

- **Address key:** JSON encoding of `[conditions, selectors, atRule ?? null,
prelude ?? null, block ?? null]`, where each condition is `[kind, prelude]`
  in outermost-first order and selector order is retained.
- **Identity key:** that tuple followed by normalized `declarations`.
  Neither key includes ordinals or source location.
- **Leading rank:** statement `@charset` = 0, `@import` = 1, `@namespace` = 2,
  `@layer` = 3; every block and other rule = 4. Decode the name before ASCII
  case folding.
- **Canonical text:** the delivered unoptimized rendering of this rule,
  including its outer conditions/nesting wrappers, faithfully preserving
  statement versus block form.
- **References:** raw tokenized URL/import values from declarations, the
  rule's own prelude and non-nesting condition preludes, using the shared
  CSS reference detector (including escaped identifiers).
- **Custom-property flag:** whether the normalized declaration runs contain
  custom properties; the existing changed-declaration keep policy still
  compares both sides, rather than treating any flag as a changed property.

The rule diff groups by address and cancels by identity. Canonical composition
sorts by rank, then identity lexically by UTF-16 code units, and concatenates
stored text; duplicates remain duplicates. Reference ownership uses stored
references. No consumer rebuilds a different identity or canonical renderer.
The `block` slot is essential: `@layer a;` and `@layer a{}` cannot cancel or
pair under one address. They are removed/added selector-less rules, retained
as unresolved on **both** linked and inline paths. This corrects the delivered
diff's missing form distinction without optimizing away either record.

## Changed-Segment Cancellation

After successful segment assembly on both sides, concatenate segments in
element/document order. For each head segment, consume the earliest unused
base segment with exactly equal key text. This is multiset cancellation,
not a set: duplicate occurrences count. Corresponding local rules become
explicit unchanged occurrence pairs. Diff only the uncancelled runs using the
ordinary [address-group diff](./mokly-css-attribution.md#rule-diff-representation).
Keep original document-wide ordinals in output.

Equal segment text guarantees equal parsed rule runs, but **does not guarantee
the delivered rule diff chooses the same changed pairs**. That diff cancels
the earliest occurrence of an identity, independently of segment formatting.
Segment cancellation can remove a later identical rule instead, changing the
order of survivors within an address. With before segments
`.a {color:red}`, `.a{color:blue}`, `.a{color:red}` and after segments
`.a{color:red}`, `.a{color:green}`, the delivered diff changes blue to green
and removes red; segment-first diff changes red to green and removes blue.
The multiset of before and after rule values is preserved, not their pairing.

Precisely: compare, per address, the identity sequences left after **all**
exact cancellations on each path. If both sequences agree, changed/added/
removed values agree (duplicate occurrence ordinals may differ). If they
differ, source-order changed pairing can differ. That can alter custom-property
or changed-reference keep judgments, attribution, selected occurrences,
materials and evidence; it is an approved Decision 5 difference, not a claim
of universal semantic equivalence. It occurs only through displaced duplicate
identities across differently keyed segments/runs; without that displacement
the two diffs agree. The injected whole-input fallback has no such difference.

[M5](../../plans/scalable-inline-style-analysis.md#milestone-5-changed-segment-analysis)
differential tests compare both ordered diffs and final attributions, owner
sets, retained selectors, all-excluded status, materials, membership and
evidence. Require equality in the agreeing-survivor cases, and explicit
expected pairs/outcomes in displacement cases, including custom-property and
URL variants of the example. Do not exempt arbitrary mismatches.

## Unchanged References And Composition

Keep actual occurrence pairs from segment cancellation and remaining exact
rule matches. Only those pairs may generate unchanged-reference deltas.
Each reference-bearing occurrence belongs to one unchanged pair **or** one
diffed delta, never both; no lookup by identity may pick an unmatched duplicate.
Attribute unchanged pairs with the ordinary two-sided policy. Identical pairs
may share matching work, but removals name their actual occurrences, not all
records having the identity. They contribute resource ownership only, never
retained selectors, all-excluded status or inline change evidence.

Compose actual/projected lists from **all** stored rules, including cancelled
runs, in the common canonical order. Omit exact occurrences selected as
excluded from actual and projected, and those selected as owned from projected
only. Paired unchanged omissions are symmetric. This fixes the delivered
duplicate-copy attribution bug while preserving multiplicity and the
[resource propagation contract](./mokly-inline-style-resources.md).
