# Component-aware Page Analysis

## Delivery Status

Approved target of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
implemented in [M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis):
analysis, derived references, original-page matching and the quick
check; [M9](../../plans/scalable-inline-style-analysis.md#milestone-9-fingerprinted-comparison-materials)
delivers fingerprints. [M2](../../plans/scalable-inline-style-analysis.md#milestone-2-deterministic-scale-fixture-and-complete-benchmark-evidence)
implements parse-site instrumentation; counters are owned by
[timings](./mokly-timings.md#component-analysis-counts).
The M7 supervisor fixes clarify existing provenance, ignore-subject and
material rules below; they are documentation-gap clarifications, not new behavior.

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
Cache the original pair's normalization once for retained/matching material
and paired ids. Boundary enclosure uses flat regions exclusively, even when
one marker is a DOM comment and the other is inside raw text.

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
status. Implied `html`, `head` and `body` are always subjects. Other elements
without a location are suppressed only if they have at least one located
descendant element and every located descendant starts in paired ignored
content. A first ignored child alone never suppresses an implied body or a
container with visible descendants. This rule also applies in embedded HTML.
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
caller-slot-copy records. Both sides use the same raw seeds and route. Under
the [resource proof](./mokly-component-review-fast-path.md#resource-and-one-sided-rules),
committed mode traverses only the head reader's closure and rejects a changed
Git path in it; derived mode traverses both readers independently and requires
equal closure membership/bytes as well. Resource proof failure falls through
with the prepared analysis and discovery. A non-identical fast-path attempt's
unattributed projection is not a complete inline-analysis result: fall-through
builds the attributed materials from the same original analyses. Equal original bytes need no canonical CSS parse
to settle content.
On success state is `unchanged`, `ignoredIds` is empty, `material`/inline/
resource evidence and owned sets are absent/empty. Preserve usage `inputs`
and `structure` signals as reasons; metadata/dependency reasons outside the
per-view decision remain independent.

For non-identical sources keep the delivered marker-retaining/topology,
actual/projected equality and resource proof, using analyses and derived
references rather than parsing materials.
Only ownership text edits require projection/projected-resource proof; without
them actual seeds come directly from the analyses. The projected exclusion
predicate is stable for the view, so equal discovery identities on fall-through
reuse the quick attempt's closure rather than traversing it again.
The fast path **never runs inline analysis**, including for reference-bearing
rules: a changed possibly reachable
reference takes fall-through; otherwise raw reference proof is conservative
and sufficient. Prepared analyses and discoveries are reused on fall-through.

## Fingerprinted Materials

Materials remain plain strings; equality is string equality and hashing uses
the existing string input. Insert fingerprints only when **neither side's
original text contains the reserved substring `mokly-inline-`**. If either
contains it, use delivered text materials for that entire paired view on both
sides, actual and projected: append the canonical `<style>` text after
successful analysis, or retain unchanged style elements when analysis is
skipped. No fingerprint is inserted in copies or either material on that view.

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

Both comment forms pass unchanged through ignore normalization and component
marker stripping: neither marker pattern matches them. The reserved-prefix
guard ensures an authored lookalike cannot equal an inserted fingerprint;
there is no token sequence, tagged material representation or consumer API change.
Apart from the ordinary SHA-256 collision assumption, equal canonical inputs
give equal rule comments, and unequal ones differ: replacing the old common
appendix wrapper preserves material equality. In-place comments likewise keep
each element's source identity **and position**, so moving an identical style
past retained markup remains a material change. Do not append a single digest
when analysis is skipped.
Differential tests compare state, material flags, reasons, resources, owners and
evidence against text-material oracles, not the deliberately changed bytes on
fingerprinted views. Require string-material compatibility through normalization
and hashing, unchanged stored references, and a moved identical style element.
Test the reserved substring on only base, only head and both sides, including
authored lookalikes and movement past one; those cases require verbatim material
byte equality to the text oracle and no inserted fingerprints on either side.
