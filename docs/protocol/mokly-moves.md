# Moves

## Delivery Status

Pairing, validation, diagnostics and comparison delivery implement this contract.
The remaining viewer labels and details follow the
[path identity plan](../../plans/path-identity.md).

Because an entry's path is its identity, moving a file or renaming a
directory changes identity. This contract pairs a removed baseline entry with
an added current entry when the evidence says they are the same entry, the way
Git detects renames, and carries the result as `previousPath`. It owns the
candidate set, the signals and their order, uniqueness, normalisation, the
similarity metric, authored `movedFrom`, the review and read model fields, and
the Changes presentation.

## Candidates And Uniqueness

Pairing runs once per comparison after the baseline and current catalogues are
both validated. The candidates are the baseline entries whose path names no
current entry of the same kind, and the current entries whose path names no
baseline entry of the same kind. A pair always joins one removed and one added
entry of the same kind. Variants pair through their parent first: when a parent
pairs, each current variant whose slug equals a baseline variant's slug pairs
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
   under [normalisation](#normalisation).
3. **Same source and title.** Both entries come from the same repository
   source module and have equal titles. Documents never use this signal,
   because the file is the source.
4. **Similar content.** Documents and pages only: the
   [similarity score](#similarity) is at least `0.5`, and the added entry's
   best-scoring removed candidate and that candidate's best-scoring added
   candidate are each other. Screens and components never use this signal,
   because shared template markup makes unrelated screens similar.

## Normalisation

Normalised content is the data the material rules of the
[Changes contract](./mokly-changes.md) compare, with every catalogue link
rewritten to a logical destination before hashing. For each view of a screen or
component variant it is the normalised view document; for a document or page it
is the normalised document per scheme; for a use case it is its ordered step
paths and step metadata; for a component parent it is its prop schema, slots,
and controls together with the pairing of every variant. A link's logical
destination is the target's current path when the target is current, the
target's paired current path when the target was paired in an earlier pass, and
otherwise the written path. Content is identical only when every corresponding
view or document is identical and the set of views is the same.

The shared paired-ignore normalizer retains real URLs separately for resource
traversal and CSS selector matching. Link canonicalization changes equality
material only; it never changes captured documents or the selector matching tree.
Copied document resources at corresponding relative references remain unmodified
when their confined before/after bytes match. This proof is scoped to that document.
Reviewable references use the same paired identities: flow steps, memberships,
variant parents, component usage and `relatedDocs` links to discovered documents.
Unmatched repository document labels remain literal metadata.

## Similarity

The similarity score of two documents or pages is computed over the lines of
their normalised documents for the light scheme, after trailing whitespace is
removed and line endings are unified. With `shared` the size of the multiset
intersection of the two line lists, the score is
`2 × shared ÷ (linesBefore + linesAfter)`, a number from `0` to `1`. The
threshold is `0.5`, inclusive, and ties for the best score make the entry
ambiguous.

An LF or CRLF terminates a line without adding an extra trailing empty line;
interior empty lines count. Two empty documents have score `1`; exactly one
empty document has score `0`. A tie counts only among eligible scores at or
above the threshold, independently on each side, even if only one tied edge
would otherwise be mutual.

## Declared Moves

A screen, page, use case, component, or variant declares `movedFrom` in its
definition; a document declares it in front matter. The value is a complete
path. Build validation rejects a value outside the path grammar, a value equal
to the entry's own path, a value that names a current entry, and the same
value on two current entries, under the
[entry module diagnostics](./mokly-entry-modules.md#diagnostics). Pairing
rejects nothing: a `movedFrom` that names no removed baseline entry of the same
kind leaves the entry `added` and records the comparison diagnostic
`<path>: movedFrom <path> matched no removed baseline entry of kind <kind>`.
A nonmatching declaration excludes that added entry from later signals.
A declaration may be removed once the base branch contains the move; keeping
it is harmless, because it names no removed entry.

## Result

The review result and the public read model carry `previousPath` on every
paired current entry; the field is absent on unpaired entries. A paired
entry's `changes.kind` follows the ordinary classification of its comparison
with the paired baseline entry: `unmodified` when nothing material or
reviewable differs, otherwise `changed`. The four change kinds are unchanged.
A paired entry is `included` in Changes even when unmodified, so a pure move is
visible, and the summary counts it under `moved` beside the existing counts
without adding it to `output changes`. The paired baseline entry is not
removed: no removed record, removed preview, or removed row is produced for it.
A paired entry's comparison, previous version, and per-view evidence use the
paired baseline entry's documents as the before side.

Review v5 continues to contain screen, component and use-case records only.
Each moved record carries `previousPath`; a pure move has an explicit empty
`ChangedEntry.reasons` list. Page/document membership and prior paths belong to
the catalogue snapshot and read model, not synthetic visual review records.
The internal `ReviewArtifact.pairing` and `ComponentChangeSnapshot.pairing`
retain `{ moves: { kind, path, previousPath }[], diagnostics: string[] }` for all
kinds. The artifact summary consumes these fields for its all-kind `moved`
count and exact diagnostics. They are not fields of `review.json` or public
catalogue JSON. Plain builds publish no inferred or authored `previousPath`.

Complete and selected capture retain each side's actual spelling and source
documents. A moved component variant groups beneath its current parent; a
removed variant stays with its baseline parent. A removed parent can therefore
have an empty historical variant group after all its variants pair elsewhere.
Affected-consumer evidence retains historical context and chain paths; its
canonical consumer and changed-component identity use the accepted current path.

The viewer labels a paired entry `Moved` in Changes rows and details and shows
the previous path in details; the [variant navigation](./mokly-variant-navigation.md)
and [catalogue changes](./mokly-catalogue-changes.md) contracts own the rows.
Mokly Cloud may use `previousPath` to move comment anchors on publish; that is
outside this repository.

## Links

A link to a path that names no current entry is `unknown-link-target` unless a
validated map knows its current destination. Build, Check, and initial Serve,
export and comparison compilation use only the current catalogue's authored
`movedFrom` hints. They do not infer moves from incomplete output or prepare a
baseline solely to improve a failed link diagnostic.

After comparison accepts both catalogues and its pairs, saved on-demand and
temporary-props renders in that same renderer generation also receive those
pairs. Accepted pairs take precedence over authored hints. The destination must
still name a current entry of the paired kind. Runtime replacement and unavailable
comparison evidence clear the accepted map; a mismatched generation is rejected.

A known prior path reports `moved-link-target` with the new path under the
[path diagnostics](./mokly-paths.md#diagnostics). If neither map knows it, the
failure remains `unknown-link-target`. Links never follow a move automatically.

## Verification

Coverage must prove each signal in isolation, the pass order, uniqueness and
ambiguity with its exact diagnostic, variant pairing through parents, link
normalisation across an earlier pair, the similarity formula at and around the
threshold, every `movedFrom` validation and the no-match diagnostic, the
`previousPath` fields and counts in the review result and read model,
suppressed removed previews, and the `moved-link-target` text.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md)
- [Markdown documents](./mokly-documents.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Catalogue change metadata](./mokly-catalogue-changes.md)
- [Removed content previews](./mokly-removed-previews.md)
