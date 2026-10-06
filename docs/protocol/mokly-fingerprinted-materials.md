# Fingerprinted Comparison Materials

Continuation of [mokly-page-analysis](./mokly-page-analysis.md).

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
Use lazy [view-local proofs](./mokly-material-work-counts.md#source-proof-reuse); shortcuts build no fingerprint inventories/indexes.
Seam work never scans sheet-sized pieces or constructs materials. Include actual
single-document and actual/projected pair normalization; unprovable structure keeps text/errors.
Existing M8 source guards and `<!--mokly-` in canonical appendices keep text too;
canonical markers must reach normalization unchanged. Those checked appendices
need no index scan. No fingerprint appears on a guarded view.

Path/move normalization keeps real URLs in resource materials. For skipped
analysis, identical-source link normalization (`equalSource === true`) needs no
fallback. Without that proof, keep text if either normalizer changes an eligible
outer source. For resolved analysis, compare the before/after appendices for
actual and projected materials separately. Keep text only if normalization
changes an equality outcome: `(links.before(Ab) === links.after(Aa)) !== (Ab === Aa)`.
An unchanged local URL beside another rule's edit can keep fingerprints.
Resource seeds still come from original and retained-rule records.

Use SHA-256 over **UTF-8 bytes**, encoded as unpadded base64url (43 characters):

- After successful inline analysis, remove eligible unowned outer spans and
  append `<!--mokly-inline-rules:<digest>-->` at the canonical appendix
  position after the source, in both actual/projected materials. The digest
  input is the canonical rendering of that side's retained rule multiset,
  not the `<style>` wrapper or original element source; even an empty
  retained list gets the digest of empty text. References come from retained
  stored rule references, with the same ownership and exclusions.
- When analysis skips for equal ordered sources, require delivered text to equal
  each eligible outer source on both sides. Any intersecting marker/signal/header
  removal or replacement, or source resource record, keeps the whole view on text.
  Anchor/navigation records allow fingerprints. Every exact original occurrence must
  be eligible (`indexOf`, including overlaps). Reject [position-exact style-copy
  seams](./mokly-material-work-counts.md#skipped-style-equality) too; otherwise
  replace each eligible element in place with `<!--mokly-inline-style:<digest>-->`;
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
