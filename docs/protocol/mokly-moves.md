# Moves

## Candidates And Uniqueness

Pairing runs once per comparison after the base and current catalogues are
both validated. The candidates are the base entries whose path names no
current entry of the same kind, and the current entries whose path names no
base entry of the same kind. A pair always joins one removed and one added
entry of the same kind. Variants pair through their parent first: when a parent
pairs, each current variant whose slug equals a base variant's slug pairs
with it, and the remaining variants of that kind continue through the signals
as ordinary candidates.

Candidate identity and variant slugs use case-folded paths. Case-only changes
are existing identities, never moves. A component parent can move only to
another component parent; component variants can move only to variants. This
does not change same-path parent/variant shape-change classification.

The signals run as passes in the order below. Within a pass, an added entry
pairs with a removed entry only when it matches exactly one removed candidate
under that signal and that removed candidate matches exactly one added
candidate. An added or removed entry that matches two or more counterparts is
ambiguous: it pairs with nothing in that pass or any later pass, and the
comparison records the diagnostic
`added <kind> <path> matches removed entries <path> and <path>; declare movedFrom to pair it`,
listing every match in UTF-16 order. Paired entries leave the candidate set
before the next pass.

For an ambiguous removed entry the symmetric diagnostic is
`removed <kind> <path> matches added entries <path> and <path>; declare movedFrom to pair it`.
List every counterpart, joined by `and`. A pass evaluates its candidate set
before accepting pairs; it does not make greedy choices after removing a pair.
Automatic same-slug variant pairs follow each accepted parent before the next
signal. An explicit variant declaration takes precedence in the declared pass.
Within each pass a proven parent claims its same-slug children before independent
variant matches or ambiguity diagnostics. Parent content equality requires a
pairing or identical view evidence for every variant, not schema and slugs alone.

## Signals

1. **Declared.** The current entry's `movedFrom` names the removed entry's
   path. This pass is exact and runs first so authors can resolve any other
   outcome.
2. **Identical content.** The normalised content of the two entries is equal
   under [normalisation](#normalisation). Repeat this pass with each new set of
   accepted pairs until it accepts no more pairs. Every iteration evaluates its
   full remaining candidate set; ambiguity is permanent across iterations.
   Recompute logical-reference signatures after accepting pairs. Group candidates
   by kind, component role, ignore contract and a hash of normalised material.
   Full equality checks run only within equal hash groups, except that different
   ignore-region sets or material-key presence require paired comparison.
   A hash is a prefilter, never proof of equality.
3. **Same source and title.** Both entries come from the same repository
   source module and have equal titles. Documents never use this signal,
   because the file is the source.
4. **Similar content.** Documents and pages only: the
   [similarity score](#similarity) is at least `0.5`, and the added entry's
   best-scoring removed candidate and that candidate's best-scoring added
   candidate are each other. Screens and components never use this signal,
   because shared template markup makes unrelated screens similar.

## Normalisation

Normalised content is the data the
[materiality rule](./mokly-comparison.md#materiality) of the comparison
contract compares, with every catalogue link rewritten to a logical
destination before hashing. For each view of a screen or component entry it
is the view's canonical form; for a document or page it is the canonical form
of the document per scheme; for a use case it is its ordered step
paths and step metadata; for a component parent it is its prop schema, slots,
and controls together with the pairing of every variant. A link's logical
destination is the target's current path when the target is current, the
target's paired current path when an earlier pass or iteration accepted it, and
otherwise the written path. Content is identical only when every corresponding
view or document is identical and the set of views is the same.

The canonical form keeps real URLs separately for resource traversal and CSS
selector matching. Link canonicalization changes equality
material only; it never changes captured documents or the selector matching tree.
Resource references compare by their resolved mockups-relative route, with query
and fragment retained. Relative spelling and directory depth are not material.
During candidate matching, bundled stylesheets, assets and copied document
resources at different routes can use equal content digests; same-route resources keep
route identity. CSS digests resolve their URL tokens recursively. Accepted entry
moves map root-module stylesheet routes and assets under corresponding source
directories. Document resources map by their source-relative reference. Re-exporting entry roots use the corresponding accepted view's rendered
references: pair unique equal digests, or its sole removed and added resource of
the same resource kind. Accept only unique aliases present in the retained
sets, and scope HTML rewriting to the paired current view's references.
Compare the mapped bytes as well; CSS compares bytes after resolving its URLs
through the same resource map. Equal moved resources suppress current
rendered-resource evidence. A different image or stylesheet stays
resource evidence under the ordinary attribution rules. A per-view byte proof
requires both corresponding references, so an unrelated equal file cannot hide
an edit. These aliases affect comparison only, never Serve or snapshot routes.
Inventoried source paths relocated under accepted defining-module moves also
share logical identity for ownership metadata. Confined base and head reads
must prove equal bytes before their relocation loses dependency evidence; edits
keep that evidence. Missing source proof never suppresses a dependency reason.

Reviewable references use the same paired identities: flow steps, memberships,
variant parents, component usage and `relatedDocs` links to discovered documents.
Unmatched repository document labels are literal metadata.

## Similarity

Similarity uses author content, never the rendered document template. A
Markdown document uses its body after the BOM and front matter are removed.
Head bodies come from the working tree; base bodies come from regular,
inventoried source files at the base commit, read from Git blobs. They are
private and never enter a public artifact. Unavailable source content supplies
no similarity evidence; there is no fallback to rendered HTML or a later
generation.

A page uses text from the body of its light-scheme canonical form. Block elements and `br` end a line; table cells separate text with a
space. Inline source whitespace collapses to one space, while `pre` keeps line
breaks. Trim lines and omit empty lines. Exclude head, script, style, template,
noscript, `hidden` and `aria-hidden="true"` subtrees. This static text rule needs
no browser, CSS evaluation or shared head markup. Changed tags or attributes
still count in ordinary material classification, but cannot inflate similarity.

Remove trailing whitespace and unify LF/CRLF. With `shared` the multiset
intersection of the two line lists, the score is
`2 × shared ÷ (linesBefore + linesAfter)`. The threshold is `0.5`, inclusive.
An LF or CRLF terminates a line without adding an extra trailing empty line;
interior empty Markdown lines count. Empty or unavailable author content cannot
justify a similar-content pair. Ties at or above the threshold make each tied
side ambiguous, even when only one edge would otherwise be mutual.

## Declared Moves

A screen, page, use case, component, or variant declares `movedFrom` in its
definition; a document declares it in front matter. The value is a complete
path. Build validation rejects a value outside the path grammar, a value equal
to the entry's own path, a value that names a current entry, and the same
value on two current entries, under the
[entry module diagnostics](./mokly-entry-modules.md#diagnostics). Pairing
rejects nothing: a `movedFrom` that names no removed base entry of the same
kind leaves the entry `added` and records the comparison diagnostic
`<path>: movedFrom <path> matched no removed baseline entry of kind <kind>`.
A nonmatching declaration excludes that added entry from later signals.
A declaration may be removed once the base branch contains the move; keeping
it is harmless, because it names no removed entry.

## Result

The review result and the public read model carry `previousPath` on every
paired current entry; the field is absent on unpaired entries. A paired
entry's `changes.kind` follows the ordinary classification of its comparison
with the paired base entry: `unmodified` when nothing material or
reviewable differs, otherwise `changed`. The four change kinds are unchanged.
A paired entry is `included` in Changes even when unmodified, so a pure move is
visible, and the summary counts it under `moved` beside the existing counts
without adding it to `output changes`. The paired base entry is not
removed: no removed record, removed preview, or removed row is produced for it.
A paired entry's comparison, previous version, and per-view evidence use the
paired base entry's documents as the before side. The
[branch-point lookup](./mokly-branch-point-lookup.md) owns shell reference,
counterpart and parent resolution, including supplied-input pairing.

Review v8 contains screen, component and use-case records only.
Each moved record carries `previousPath`; a pure move has an explicit empty
`ChangedEntry.reasons` list. Page/document membership and prior paths belong to
the catalogue snapshot and read model, not synthetic visual review records.
The comparison keeps its pairing,
`{ moves: { kind, path, previousPath }[], diagnostics: string[] }`, for all
kinds; the summary's all-kind `moved` count and the exact diagnostics come
from it. Serve reports each diagnostic through its terminal
reporter when the classification generation is accepted. Superseded generations
stay silent. `build` and `publish` report them during comparison. Plain
mode writes the exact diagnostic and a newline; rich mode uses the existing
bounded diagnostic presentation under [terminal output](./mokly-terminal-output.md).
They are not fields of `review.json` or public catalogue JSON. A build without
Changes publishes no inferred or authored `previousPath`.

Complete and selected comparisons keep each side's actual spelling and source
documents. Group each compared view with the same side of its variant pair:
current views use the current variant path; base-only views use the
base variant path. Keep the union of viewports and schemes when a move
adds or removes views. A moved component variant groups beneath its current
parent; a removed variant stays with its base parent. A removed parent can therefore
have an empty historical variant group after all its variants pair elsewhere.
The index and detail readers accept that removed parent with zero
variants and keep its removal row; they must not restore the moved variants
under it or omit the parent. A current variant requires a current parent; a
parent needs no variant.
Affected-consumer evidence keeps each side's context and chain paths. Its
canonical consumer and changed-component identity use the accepted current path.

The viewer labels a paired entry `Moved` in Changes rows and details and shows
the previous path in details; the [variant navigation](./mokly-variant-navigation.md)
and [catalogue changes](./mokly-catalogue-changes.md) contracts own the rows.
Mokly Cloud may use `previousPath` to move comment anchors on publish; that is
outside this repository.

## Links

A link to a path that names no current entry is `unknown-link-target` unless a
validated map knows its current destination. `build` and Serve's first
generation use only the current catalogue's authored `movedFrom` hints. They
do not infer moves from incomplete output or render the base solely to improve
a failed link diagnostic.

After comparison accepts both catalogues and its pairs, on-demand and
temporary-props renders in that same generation also receive those pairs. Accepted pairs take precedence over authored hints. The destination must
still name a current entry of the paired kind. Runtime replacement and unavailable
comparison evidence clear the accepted map; a mismatched generation is rejected.

A known prior path reports `moved-link-target` with the new path under the
[path diagnostics](./mokly-paths.md#diagnostics). If neither map knows it, the
failure stays `unknown-link-target`. Links never follow a move automatically.

## Verification

Coverage must prove each signal in isolation, the pass order, uniqueness and
ambiguity with its exact diagnostic, variant pairing through parents, link
normalisation across passes and iterations, the similarity formula at and around the
threshold, every `movedFrom` validation and the no-match diagnostic, the
`previousPath` fields and counts in the review result and read model,
suppressed removed previews, and the `moved-link-target` text. Regressions cover
unrelated short Markdown, edited moves, depth-changing resource URLs and imported
CSS, linked screens/flows/component users moving together, permanent ambiguity,
linear full-comparison counts for unique material, and Serve and `build`
diagnostics. Run move fixtures through review, the index and detail readers,
Serve and `build`;
include deleting a component after its last variant moves to another parent.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md)
- [Markdown documents](./mokly-documents.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Removed content previews](./mokly-removed-previews.md)
