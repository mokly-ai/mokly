# CSS Parse Reuse

## Delivery Status

Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md):
the bounded whole-input cache is implemented in
[M3](../../plans/scalable-inline-style-analysis.md#milestone-3-bounded-memory),
verified segments, their cache and stored rule data in
[M4](../../plans/scalable-inline-style-analysis.md#milestone-4-rule-segment-parse-reuse).
[M5](../../plans/scalable-inline-style-analysis.md#milestone-5-changed-segment-analysis)
cancellation, matched-copy references and composition remain pending. Whole
parsing is the assembly oracle; the full rule-list diff stays authoritative until M5.

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
  verified flat rule run with local ordinals, stored derived data and its
  identity-run key. It never caches a partially verified batch or a
  context-dependent segment.

Each bound is **64 MiB = 67,108,864 estimated bytes**, not a rule count or
an actual-heap promise. An entry costs `64 + 96 * ruleCount + 2 * stringUnits`:
`stringUnits` sums UTF-16 code units in the key and every retained string slot,
including declarations, selectors, conditions, keys, canonical text, references
and retained error data (including own property names). Fixed-shape record
property names are not slots; string-valued tags such as `status` and condition
`kind` are. Count repeated slots even if their strings share storage; count the
key once. The estimate is computed on insertion only; entries are immutable.
Safe error snapshots preserve exactly Error, EvalError, RangeError,
ReferenceError, SyntaxError, TypeError, URIError, AggregateError and
CssRuleParseError, plus arrays, plain records, strings, numbers, booleans,
null and undefined, including stacks and nested causes. Property names are
counted without copying. Every other error class, cycles, proxies, symbols,
functions, custom prototypes and non-native accessors are opaque: use the
original failure without caching or invoking its accessors. This also applies
to an injected parser throwing such a payload.

Snapshot errors use `Error.stackTraceLimit = 0`, restored in `finally`, preventing
hidden V8 frames from retaining sources. Production-path GC tests prove release.

Every retained key and source-derived string is an independent flat copy with
identical code units, not a slice keeping a larger stylesheet or HTML alive.
Independent UTF-16LE copying preserves lone surrogates; per-slot GC proves release.
The cached run never retains a document, element, batch source or absolute
location. On hit move the entry to most-recent using its stored flat key, never
the caller's possibly sliced lookup key; on insertion evict least-recent
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
  not segments, except for the CDO anomaly below. Once a rule begins they
  remain part of its source.
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
Outside strings, comments and opaque URLs, a depth-zero `<!--` followed
immediately by a word code unit
(`[A-Za-z0-9_\-\\]` or any code unit at least U+0080) is also an anomaly.
The delivered tokenizer joins that character to the `--` token beginning
inside CDO; the parser skips that entire token. Treating only CDO as trivia
would therefore change the whole parse. The scanner and assembly differential
tests must cover `<!--a{color:red}`, `<!---->`, `<!--body{color:red}-->` and
`b{color:blue}<!--a{color:red}`: whole fallback preserves their unresolved result.

## Batched Parsing And Verification

Process elements independently, preserving stylesheet boundaries. Resolve hits
first; batch distinct misses in first-occurrence order separated by LF, record
start/end offsets, and reuse verified duplicate runs. Append `\n@mokly-segment-end;`;
require one extra native root at its exact offset (source index zero), proving
the final terminator was consumed. Never retain the sentinel. Invoke Lightning
CSS once before optimization with delivered options; surrounding trivia is absent.

Inspect native source roots, excluding the sentinel, not flattened records:
each segment must have exactly one top-level rule beginning at its recorded
start, wholly within its interval, and ending at its terminator. Every native
top-level rule must be assigned to exactly one segment. Flatten that root's
descendants with the delivered collector; a grouped/nested segment may yield
several records, in depth-first order. Verify each recovered header, body and
local location against the segment, with no declaration run crossing its end.
Cached runs have local ordinals; assembly accepts the document ordinal base
and copies each occurrence at most once. Never mutate a cached run.

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

Compute once on first use, from detached material for cached rules, on both paths:

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
- **References:** exactly `cssRuleReferences`' ordered concatenation of the
  shared detector's results: apply it to each non-`nesting-parent` condition
  prelude, then to `@<atRule> <prelude>;` when an at-rule exists (omit the space
  when the prelude is empty), then to declarations. Preserve duplicates and
  escaped-identifier handling. A bare own prelude is insufficient:
  `@import "theme.css";` must record `theme.css`.
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

For each verified segment run, compute one unambiguous **identity-run key**:
JSON encoding of its ordered array of rule identity keys, including an empty
array for a zero-rule run. Store it once with the cached run and count its
string units in the cache estimate. This is the cancellation key, not the
segment text key used for parsing reuse.

## Changed-Segment Cancellation

After successful segment assembly on both sides, concatenate segments in
element/document order. For each head segment, consume the earliest unused
base segment with exactly equal identity-run key. This is multiset cancellation,
not a set: duplicate occurrences count. Corresponding local rules become
explicit unchanged occurrence pairs. Diff only the uncancelled runs using the
ordinary [address-group diff](./mokly-css-attribution.md#rule-diff-representation).
Keep original document-wide ordinals in output.

For runs containing a single rule, the key is just that rule's identity in an
array. Both cancellation and the full rule diff pair the head's k-th occurrence
of an identity with the base's k-th occurrence. Thus unchanged pairs, survivor
occurrences, ordinals and source-order changed/added/removed pairs are identical
when all runs contain at most one rule. Empty runs contribute nothing. This
covers every flat stylesheet, including React Native Web output, independently
of formatting or splits across elements. With before segments
`.a {color:red}`, `.a{color:blue}`, `.a{color:red}` and after segments
`.a{color:red}`, `.a{color:green}`, **both** paths cancel the first red, change
blue to green and remove the last red.

Displacement remains possible only when grouped/nested multi-rule runs share
rule identities with differently shaped runs. For example, base segments are
`@media screen{.a{color:red}}`, `@media screen{.a{color:blue}}` and
`@media screen{.a{color:red}.b{color:black}}`; head segments are
`@media screen{.a{color:red}.b{color:black}}` and
`@media screen{.a{color:green}}`. Full diff cancels the first red and black,
changes blue to green and removes the later red. Segment-first cancellation
cancels the third base run as a whole, changes the first red to green and
removes blue. The rule-value multisets are preserved, not their pairing.

Precisely: compare, per address, the identity sequences left after **all**
exact cancellations on each path. If both sequences agree, per-address changed/
added/removed values agree, but choosing different duplicate occurrences can
change ordinals and global diff ordering. If the sequences differ, source-order
changed value pairing can differ. That can alter custom-property
or changed-reference keep judgments, attribution, selected occurrences,
materials and evidence; it is an approved Decision 5 difference, not a claim
of universal semantic equivalence. It occurs only through displaced duplicate
identities across differently shaped grouped/nested runs; formatting alone
cannot cause it. Without that displacement the two diffs agree. The injected
whole-input fallback has no such difference.

[M5](../../plans/scalable-inline-style-analysis.md#milestone-5-changed-segment-analysis)
differential tests compare both ordered diffs and final attributions, owner
sets, retained selectors, all-excluded status, materials, membership and
evidence. Require exact ordered diffs and occurrence pairs/ordinals for flat
formatting duplicates, the flat example above and cumulative React Native Web
runs. For grouped/nested agreeing-survivor cases require equal per-address
value diffs, attribution values/multiplicities and final results; assert the
actual selected duplicate ordinals/pairs and any global ordering difference
explicitly, rather than claiming ordinal equality. For displaced survivor
sequences assert exact changed pairs and final outcomes, including
custom-property and URL variants of the grouped example. Do not exempt
arbitrary mismatches.

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
