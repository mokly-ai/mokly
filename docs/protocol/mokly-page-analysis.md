# Component-aware Page Analysis

## Delivery Status

[M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis) implements
original analysis, derived references, matching and quick checks;
[M9](../../plans/scalable-inline-style-analysis.md#milestone-9-fingerprinted-comparison-materials) implements fingerprints. [Timings](./mokly-timings.md#component-analysis-counts) owns work counters.

## Scope And Lifetime

Component-aware means the shared per-view comparison loop when **either**
manifest registers components, including views with empty usage. Pass that
scope through the view context and resource comparison. Page analysis,
fingerprints and the [style-only route](./mokly-style-only-route.md) do not
change the classifier for catalogues without registered components. Their
shared loop retains its delivered matching and parsing. The separate
`classifyChangedContent` page path, including pages in component catalogues,
also retains ignore-normalized matching and its existing parse/cache policy;
it does not share the view analyses or their CSS cache. Duplicate page/resource
parses from that separate path are counted, not removed by extending scope.
Baseline admission is manifest **v7 only**, under
[baseline compatibility](./mokly-baseline-compatibility.md): all ownership and
review markers use the current `mokly-` syntax. No retired `mokabook-` dialect
normalization or historical-dialect route exists; those strings are ordinary
text/comments, not ownership or ignore markers.

Create one analysis lazily for each view side and discard it with the view.
It holds that side's original text and its one source-located default-adapter
parse5 tree. It is not a catalogue-lifetime page cache. The quick check,
projection, inline analysis, implementation comparison and linked-CSS matching
share it; none parses rewritten/normalized page HTML. An identical-text quick
check may use the head analysis alone. Embedded HTML resources still use the
existing resource reader's own document parsing, separately from view analysis.
Their discovery keeps delivered paired normalization; when it changes resource
text, the reader may parse it separately from its original matching tree.
Neither resource tree is a reparsed view-side material.
Original embedded-reference inventories contain visible records only, without
material derivation; the reader consumes them only when normalization leaves
text unchanged. One-sided component-aware views need no normalized HTML material.

All source spans are half-open **UTF-16** offsets into that side's original
text, before header removal, marker stripping, ignores, replacements or copies.
There is no coordinate space belonging to a normalized material. Validation
checks the original ranges against that text/tree; malformed usage still fails
with the existing document diagnostic, never with an optimization fallback.

## Contents And Ignore Pairing

The analysis supplies validated ranges/owners, eligible unowned style
outer/content spans under [inline scope](./mokly-inline-styles.md#scope),
the tree, reference records and validated ignore regions/material signals.
Source-less implied elements remain context without a source-range owner.

Scan the two texts with the existing flat marker validator before deciding
paired ids: current start/end ignore comments must be well formed, unique,
non-nested and correctly closed. A material signal must name a region, remain
outside it and carry its valid key. Pair ids present on both sides **except**
an id having a material signal on only one side. Such one-sided adoption, or
an id present on only one side, remains ordinary material. Preserve contract
tokens for different one-sided id sets and existing material-key normalization.

Original flat spans own region validation, pairing and content recording.
Record content from the end of the start marker through the start of the end
marker. Original pair normalization records sorted `pairedIgnoreIds` and
sorted differing paired ids. View state and emitted `ignoredIds` follow the
[actual-material state and ignore-evidence rule](./mokly-inline-styles.md#membership-and-states):
canonicalization can remove a region, which then contributes no emitted id.
This does not give original ignore evidence precedence over actual materials.
Selection uses the original spans/paired ids, never offsets in inserted tokens.
Derive paired ids from validated regions and material-signal ids, without
rendering normalized source. Cache original pair normalization lazily when the
quick proof requests it. Boundary enclosure uses flat regions exclusively,
even when one marker is a DOM comment and the other is inside raw text.

These are flat source spans, not DOM comment-node spans. Markers inside raw
text, including `<textarea>`, still delimit regions. The M7 expected case
places a start marker inside one textarea and the paired end marker inside a
later textarea, with an ordinary HTML style element between them. Its start
lies in the paired span, so it is ineligible; its references do not seed either
material. When only that region's content changes, report `ignored-only` and
that id in `ignoredIds`, with no material flag or inline evidence. A one-sided
region does not exclude the intervening style element.

## Reference Records

The [source-provenance contract](./mokly-page-source-provenance.md) owns the
complete extractor inventory, decoded values, source spans, adopted root
attributes, formatting clones, resource hints and inert-template policy.
Never discard a visible extracted value because parse5 omitted its location.

## Derived Material References

For reference derivation, retain the string's assembly recipe: ordered kept
original spans, replacement text and copies appended/inserted for caller slots.
This recipe is auxiliary metadata, not a different material value. Apply the
same replacement precedence as material text (outer instance replacements
suppress contained edits); coalesce adjacent unchanged original spans first.
Preserve delivered stripping boundaries: projected rendered source and each
caller copy strip component markers before appending the caller wrapper and
canonical style appendix, which remain verbatim. Actual materials strip the
joined source and appendix as before; authored marker lookalikes stay ordinary
canonical text in the projected appendix.
Keep a reference only when its **entire source
span** survives in one kept span; drop a record touching a removed/replaced
span or paired ignored content, even when its URL characters alone survive.
Do not join two cut attribute/text spans to invent a reference.

A copied span retains its fully contained records as distinct copied
occurrences. Copying out of an inert ancestor exposes that subtree's recorded
references; an inert template wrapper retained inside the copy still hides
its descendants. A copy of ignored content retains no references. Copies do
not borrow references from the instance/slot wrapper they omit. Fresh inserted
text carries its own producer-supplied reference inventory using the same
attribute/CSS token rules, not a second page tree or lexing across piece edges.
Identity/ignore/contract/fingerprint comments supply none. The canonical rule
appendix supplies retained stored references before and after fingerprinting;
caller-slot appendices are source copies, not newly parsed insertions.
After this derivation use the existing set/deduplication and route reader; both
actual and projected materials have separate seed sets and closures.

This **provenance-derived set is normative**, not a demand to reparse material
HTML. The differential oracle compares its resolved resource seed set and
transitive closure with discovery from the old text materials, for actual
and projected sides of every real fixture (slots, templates, ignores and
insertions included). Equality requires source-record spans to survive whole
and the rewrite/copy to preserve extraction visibility; whole-node edits alone
are not sufficient for malformed HTML or well-formed content whose meaning
depends on its receiving context. A table receiver's caller `td` style and an
SVG receiver's `image href` retain their original records; reparsing their
copies in body context formerly lost those references. For example, parse5
discards an `img` inside `select`;
copying that raw slot text into an appendix does not fabricate its missing
reference, unlike reparsing the appendix. In those parser-context cases,
source records keep their original visibility (with the copy exposure rule
above); references of a discarded
source token are not invented by later recovery. Record explicit expected
derived sets for such cases. This is the narrow Decision 9 refinement, not an
exception allowing unrelated resource mismatches. Partial-span replacements
have the explicit drop rule above. Referenced HTML resource discovery itself
is unchanged.

## Original-page Matching

Evaluate inline and linked-CSS selectors on each side's **original tree**.
An element whose start offset is in paired ignored content is never a matching
subject. It remains context: do not remove it or disable it inside combinators,
`:has()` or static structural predicates, including `:nth-child` and `:empty`.
An adoption-agency formatting clone takes its original element's subject
status. Implied `html`, `head` and `body` are always subjects.
Other elements without a location: with located descendant elements, they are
suppressed exactly when every located descendant starts in paired ignored
content; otherwise they take the ignore status of the start offset of the token
whose processing created them. Apply this in embedded HTML too.
The adopted root attributes remain original context, including those supplied
by a start tag inside paired ignored content: an earlier ignored class still
shadows a later visible class. References drop by span; this is the existing
original-tree context difference, not a new rule.
Ignored text/comment nodes also remain their ordinary structural context.
The predicate suppresses only final selected subjects; it is not a filter on
the tree adapter's children/parent/sibling operations. Template contents remain
inert matcher boundaries. Resolve owners against original validated ranges
with the existing input-owner/slot/root rules, never normalized offsets.

This replaces ignore-normalized matching: removing regions formerly changed
surrounding subjects' combinator/structural matches or root adoption. Only these
original-context matching outcomes change; differentials assert actual-tree results.

## Identical-text Quick Check

The [unchanged decision](./mokly-component-review-fast-path.md) first tests same
path, exact original-text equality and canonical usage-topology equality,
allowing entry-owned input changes. Validate ignores/ranges through the head
analysis and share it for both sides, without projection, rewritten materials,
hashing, inline analysis or implementation comparison. Reject literal
`<!--mokly-review-` in eligible outer sources and potential decoded reserved
markers under the [source-only guard](./mokly-component-review-fast-path.md#source-only-escape-guard):
serialization can decode escapes and join whitespace/comments into markers.

Shared raw seeds include original **and** potential caller-slot-copy records.
The [resource proof](./mokly-component-review-fast-path.md#resource-and-one-sided-rules)
traverses only the head closure in committed mode, rejecting changed Git paths.
Derived mode independently compares both closures' membership/bytes.
A non-identical attempt's unattributed projection is not a complete inline result:
fall-through builds attributed materials from the same original analyses.
On success state is `unchanged`, `ignoredIds` is empty, `material`/inline/
resource evidence and owned sets are absent/empty. Preserve usage `inputs`
and `structure` signals as reasons; metadata/dependency reasons outside the
per-view decision remain independent.

Non-identical sources retain marker/topology, material and resource proofs and
require equal ordered eligible style sources: ignored markup can change eligibility.
Only ownership edits require projection/projected-resource proof; otherwise
actual seeds come directly from analyses. Stable per-view projected exclusion
and equal discovery identities reuse the quick attempt's closure on fall-through.
The fast path **never runs inline analysis**, including for reference-bearing
rules. A changed possibly reachable reference takes fall-through. So does a
resource record within an eligible unowned style's outer span that touches a
paired-ignore or removed span: canonicalization may retain its reference after
raw provenance drops it. Detect this from the original records and spans,
without parsing CSS. Both literal/decoded guards inspect only the head for
identical sources and both sides for non-identical sources. The derived base proof uses optional reads at every graph depth:
missing files fail proof without replacing complete required-read diagnostics.

## Fingerprinted Materials

Materials remain strings, compared and hashed as strings. Keep delivered text
on **both sides, actual and projected**, if either original contains
`mokly-inline-`, or a delivered rewrite could create it or create/complete a
reserved marker. A seam joins pieces not adjacent in the original: component
and ignore boundaries, signals, styles, caller copies and inserted text all
participate. Check the last 12 UTF-16 units before and first 12 after each seam,
walking across tiny pieces. Reject `mokly-inline-` or `<!--mokly-` crossing it.
Also reject a seam inside an unclosed `<!--mokly-review-` or
`<!--mokly-component:` opener, including an opener name completed by a join.
Use per-side opener/close offsets. Inserts are closed by construction: appendix
comments, placeholders, contract tokens and wrappers are complete markers/tags.
Index originals once per used side, lazily; quick/style routes do no indexing.
Seam work never scans sheet-sized pieces or constructs materials. Include actual
single-document and actual/projected pair normalization; unprovable structure keeps text/errors.
Existing M8 source guards and `<!--mokly-` in canonical appendices keep text too;
canonical markers must reach normalization unchanged. Those checked appendices
need no additional index scan. No fingerprint appears on a guarded view.

Use SHA-256 over **UTF-8 bytes**, encoded as unpadded base64url (43 characters):

- After successful inline analysis, remove eligible unowned outer spans and
  append `<!--mokly-inline-rules:<digest>-->` at the canonical appendix
  position after the source, in both actual/projected materials. The digest
  input is the canonical rendering of that side's retained rule multiset,
  not the `<style>` wrapper or original element source; even an empty
  retained list gets the digest of empty text. References come from retained
  stored rule references, with the same ownership and exclusions.
- When analysis skips for equal ordered sources, keep text for the whole view
  if any eligible outer span contains a source resource record on either side.
  Anchor/navigation records do not block fingerprints. On **each** original side,
  every exact outer-source occurrence of each skipped element must be an eligible
  span (use `indexOf`, including overlaps). Otherwise keep text for the whole view.
  Also reject [seams that could assemble a style copy](./mokly-material-work-counts.md#skipped-style-equality).
  Replace each eligible element in place with `<!--mokly-inline-style:<digest>-->`;
  hash its complete outer source, including tags/attributes; supply no references.
- A parse failure retains original style text verbatim, not a successful-rule
  fingerprint. Ownership projection/ignore normalization otherwise retain
  their existing ordering and semantics; copied spans carry the same edits.

Both forms survive ignore normalization and component stripping. Under the
ordinary SHA-256 collision assumption, equal inputs give equal comments and
unequal inputs differ; guards exclude authored lookalikes and interchangeable
non-replaced copies, including joins. Moving a style past retained markup stays
material. The [required proofs](./mokly-material-work-counts.md#required-proof)
cover results/errors, retained references, exact bytes on fallback and work.
