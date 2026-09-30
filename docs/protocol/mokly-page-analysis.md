# Component-aware Page Analysis

## Delivery Status

Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
not yet implemented: [M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis)
delivers analysis, derived references, original-page matching and the quick
check; [M9](../../plans/scalable-inline-style-analysis.md#milestone-9-fingerprinted-comparison-materials)
delivers fingerprints. [M2](../../plans/scalable-inline-style-analysis.md#milestone-2-deterministic-scale-fixture-and-complete-benchmark-evidence)
first instruments the delivered parse sites; counters are owned by
[timings](./mokly-timings.md#component-analysis-counts).

## Scope And Lifetime

These rules apply only to component-aware classification, including views
with empty usage in a catalogue registering components. Page analysis,
fingerprints and the [style-only route](./mokly-style-only-route.md) do not
change the classifier for catalogues without registered components.
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

All source spans are half-open **UTF-16** offsets into that side's original
text, before header removal, marker stripping, ignores, replacements or copies.
There is no coordinate space belonging to a normalized material. Validation
checks the original ranges against that text/tree; malformed usage still fails
with the existing document diagnostic, never with an optimization fallback.

## Contents And Ignore Pairing

The analysis supplies validated instance/slot ranges and owner lookup,
eligible unowned style outer/content spans under
[inline scope](./mokly-inline-styles.md#scope), the element tree, reference
records, and validated ignore regions/material signals. Source-less implied
elements remain matcher context but cannot acquire a source-range owner.

Scan the two texts with the existing flat marker validator before deciding
paired ids: current start/end ignore comments must be well formed, unique,
non-nested and correctly closed. A material signal must name a region, remain
outside it and carry its valid key. Pair ids present on both sides **except**
an id having a material signal on only one side. Such one-sided adoption, or
an id present on only one side, remains ordinary material. Preserve contract
tokens for different one-sided id sets and existing material-key normalization.

Record a region's content from the end of its start marker through the start
of its end marker. `pairedIgnoreIds` are sorted; `ignoredIds` are only paired
ids whose content differs, sorted, as in the delivered normalizer. Selection
and normalization use these same spans/ids, not a second marker parser on
already inserted ignore tokens.

## Reference Records

Records retain the extractor's decoded raw value **before route resolution**,
its kind, and the complete source span of the containing attribute or style
text. Also retain the containing node's original extraction visibility; inert
template descendants are inventoried for copies but do not seed the original
document. One attribute/text may supply several records sharing its span.
Keep source spelling separately where needed to map decoded values; do not
mistake a resolved path or an HTML-entity spelling for the raw extracted value.

Cover everything `extractHtmlReferences` reads:

- `id` anchors on any element; navigation `href` unless it is a resource
  source attribute; `data-nav-href` on any element.
- Resource attributes: `src` on audio, embed, iframe, img, input, script,
  source and track; `href`/`xlink:href` on SVG image/use; link `href`;
  object `data`; video `poster` and `src`.
- `srcset` on any element, one raw URL per candidate, using the delivered
  comma/descriptor tokenizer (including trailing-comma removal).
- `style` attributes, one record per tokenized CSS reference.
- Style-element text, including non-eligible style elements that ordinary
  discovery reads, one record per tokenized URL or import reference. When
  text is split across nodes, its source span covers the contributing text.

Preserve the existing `resourceHints` policy: preload, modulepreload, prefetch,
preconnect and dns-prefetch link references can be disabled unless the link
also has `stylesheet`. Preserve traversal/namespaces and inert-template policy;
the inventory may not fabricate references from arbitrary strings resembling
attributes. URL/import lexing and route-relative/transitive resolution remain
with the existing CSS detector and resource readers.

## Derived Material References

A material has provenance: ordered kept original spans, replacement text,
and copies of original spans appended or inserted for caller slots. Apply the
same replacement precedence as material text (outer instance replacements
suppress contained edits); coalesce adjacent unchanged original spans first.
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
are not sufficient for malformed HTML whose parser recovery changes after
removal or copying. For example, parse5 discards an `img` inside `select`;
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
Ignored text/comment nodes also remain their ordinary structural context.
The predicate suppresses only final selected subjects; it is not a filter on
the tree adapter's children/parent/sibling operations. Template contents remain
inert matcher boundaries. Resolve owners against original validated ranges
with the existing input-owner/slot/root rules, never normalized offsets.

This intentionally replaces ignore-normalized matching: removing ignored
children formerly changed surrounding subjects' combinator/structural matches.
Only outcomes affected by that lost context change. Differential examples must
assert the real original-tree outcome, not require the old false exclusion.
Embedded linked-HTML documents follow the same subject/context policy within
their own reader trees, without becoming view-side page analyses.

## Identical-text Quick Check

The [unchanged decision](./mokly-component-review-fast-path.md) owns decision
ordering. First test same path, exact original-text equality, and canonical
usage-topology equality (which still allows entry-owned input changes).
Validate current ignore syntax and required ranges through the head analysis;
use it for both sides' range/style/reference questions, without projection,
rewritten materials, hashing, inline rule analysis or implementation comparison.

Its discovery seeds conservatively include original records **and** potential
caller-slot-copy records. Both sides use the same raw seeds and route, but each
reader resolves/collects its own transitive closure. Committed mode rejects a
changed Git path in either reachable closure; derived mode additionally requires
equal membership/bytes. Resource proof failure falls through with the prepared
analysis. Equal original bytes need no canonical CSS parse to settle content.
On success state is `unchanged`, `ignoredIds` is empty, `material`/inline/
resource evidence and owned sets are absent/empty. Preserve usage `inputs`
and `structure` signals as reasons; metadata/dependency reasons outside the
per-view decision remain independent.

For non-identical sources keep the delivered marker-retaining/topology,
actual/projected equality and resource proof, using analyses and derived
references rather than parsing materials. The fast path **never runs inline
analysis**, including for reference-bearing rules: a changed possibly reachable
reference takes fall-through; otherwise raw reference proof is conservative
and sufficient. Prepared analyses and discoveries are reused on fall-through.

## Fingerprinted Materials

Use SHA-256 over **UTF-8 bytes**, encoded as unpadded base64url (43 characters):

- After successful inline analysis, remove eligible unowned outer spans and
  append `<!--mokly-inline-rules:<digest>-->` at the canonical appendix
  position after the source, in both actual/projected materials. The digest
  input is the canonical rendering of that side's retained rule multiset,
  not the `<style>` wrapper or original element source; even an empty
  retained list gets the digest of empty text. References come from retained
  stored rule references, with the same ownership and exclusions.
- When analysis is skipped for equal ordered reference-free outer sources,
  replace **each** eligible unowned element in place with
  `<!--mokly-inline-style:<digest>-->`; input is its complete original outer
  source, including attributes and tags. These comments supply no references.
- A parse failure retains original style text verbatim, not a successful-rule
  fingerprint. Ownership projection/ignore normalization otherwise retain
  their existing ordering and semantics; copied spans carry the same edits.

Neither form is a review/component marker or subject to marker stripping.
Apart from the ordinary SHA-256 collision assumption, equal canonical inputs
give equal rule comments, and unequal ones differ: replacing the old common
appendix wrapper preserves material equality. In-place comments likewise keep
each element's source identity **and position**, so moving an identical style
past retained markup remains a material change. Do not append a single digest
when analysis is skipped. Preserve generated-token provenance through
normalization: equality/hashing uses an ordered sequence of `text`,
`inline-rules` and `inline-style` tokens, with adjacent ordinary text coalesced
and each token encoded as a JSON `[kind, value]` tuple. Only inserted
fingerprints create fingerprint tokens; an authored lookalike comment remains
ordinary text. This avoids a moved element becoming equal to an authored
comment merely because their serialized comments look alike. Render the comment
forms above for material text, but never recover token kinds from that text.
Differential tests compare state, material flags, reasons, resources, owners and
evidence against text-material oracles, including authored lookalikes, not
the deliberately changed material bytes.
