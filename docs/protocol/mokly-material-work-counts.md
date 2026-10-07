# Comparison Material Work Counts

These integer fields belong only to `review.material-work` under
[timings](./mokly-timings.md#component-analysis-counts). `MOKLY_MATERIAL_WORK=1`
together with `--debug-timings` constructs a separate `MaterialWork` collector.
It is off by default: no instance, material scope, byte-length calculation or
material counting call runs. The core `DocumentWork` collector independently
owns path, HTML, inline, heap and exclusive-time counts, including the
`linkNormalization` parse step. Material details add no field or counting work
to its disabled-detail path.
Collection is view/classification scoped and contains no document text, hashes or paths.
Zero fields remain present. Bytes always mean UTF-8 input bytes, not UTF-16
units, retained heap or RSS. Disabled collection computes no byte lengths.

| Field                        | Counted work                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `materialBytes`              | Four assembled shared-page strings: before/after, actual/projected, after component-marker stripping and before ignore normalization. Count each rendering even if equal.                                                                                |
| `materialNormalizationBytes` | Every actual input to component-marker stripping or ignore normalization while constructing those shared-page materials, including caller pieces and single-document state checks. Pair calls count both inputs. A normalization-cache hit adds no work. |
| `sourceNormalizationBytes`   | Inputs to those normalization functions outside shared-page material construction: original quick proofs, implementation fragments and legacy/resource work. Flat original region validation/pairing is not normalization and adds no input here.        |
| `materialHashBytes`          | HTML string bytes supplied to the existing resource-closure identity digest. Provenance seed identities bypass this hash and contribute zero. Resource-file digests are not material hashes.                                                             |
| `inlineFingerprintBytes`     | Canonical rule text or complete original style outer sources passed to fingerprint SHA-256. Excludes the canonical style wrapper.                                                                                                                        |
| `inlineFingerprintHashes`    | SHA-256 operations producing inline fingerprints; repeated identical inputs within one prepared view pair reuse a digest and do not increment this count.                                                                                                |
| `fingerprintedViews`         | Prepared complete view pairs emitting at least one fingerprint comment. Guarded, unresolved, style-route and fast-path views contribute zero.                                                                                                            |
| `fingerprintSeams`           | Non-adjacent joins checked in delivered raw, paired-normalized and actual single-normalized recipes before fingerprinting.                                                                                                                               |
| `fingerprintSeamUnits`       | UTF-16 code units copied into those seam windows; at most 24 per checked seam, including traversal across tiny pieces. No retained piece's interior is scanned.                                                                                          |

Nested comparison scopes share one collector within the same enabled timing
session. Emit once in `finally`, including partial counts on failure; disabled
and separate timing sessions never borrow the enclosing collector.
Material-normalization scope nests synchronously and restores on failure.
These counts describe actual work, including attempted work before an error.
They neither select a comparison path nor alter cache, resource or validation
policy. Construction and digest times retain their existing exclusive fields;
fingerprint hashing belongs to `hashMs`, recipe seam proof and its lazy source-offset indexing to `normalizationMs`,
and the remaining inline material preparation to `inlineRuleMs`.

For growing eligible cumulative sheets, completed fingerprint material lengths,
their normalization inputs and downstream string-hash inputs stay bounded.
Fingerprint input bytes necessarily grow with the sheet and remain visible
separately. Complete preparation derives ignore pairing from validated original
metadata without normalizing the whole source. A preceding non-identical quick
attempt may still normalize originals; that is separately counted source work.
The style-only route constructs no page material and computes no fingerprints.

This is a work-bound proof, not a constant-time claim about source validation,
HTML parsing, marker indexing, CSS preparation, matching or digest input.
All materials and consumers remain strings under the
[fingerprint contract](./mokly-page-analysis.md#fingerprinted-materials).

## Companion Collection

Never enable details in timed benchmark samples: added counting can affect both
execution and GC. The [fixture harness](../../scripts/large/README.md) forces
`MOKLY_MATERIAL_WORK=0` in timed Serve workers, regardless of inherited settings,
and rejects any material/companion fields or detail events in a timed result.
The independent `details` command prepares the same deterministic scenarios,
fixture commit, template digest and rendering dependencies, then runs one fresh
classification per scenario with details enabled. It emits `Material companion`
records with `kind: material-work-companion`, `timed: false`, exact `materialWork`
counts and identity/membership evidence. Shared document/path/inline counts may
accompany them; no classification, startup, delivery duration or cold/warm label
is reported. Preserve errors/incomplete outcomes and always restore setup inputs.
Companion counts are separate evidence, never copied into timed sample records.
Historical reports retain their original values and explain the method change.

Tests pin the core collector shape, probe every detail method/constructor with
collection off/on, retain exact-count/work-bound assertions with details on, and
reject timed-record contamination. Real Serve proves environment isolation,
companion counts/membership and scenario restoration.

## Required Proof

Fingerprint/text differentials compare state, material flags, reasons, resource
and ownership evidence, inline evidence, errors and validation; only fingerprint
bytes may differ. Cover every inline/CSS/Changes catalogue and the small scale
renderers with and without Git evidence for generated view paths. Check all four
fast/style switches for guarded cases.

Require exact text material bytes for base-only, head-only and two-sided source
or seam guards, authored lookalikes, movement, copied slots, inserted tokens and
all removal/normalization joins. Check skipped raw references independently of
stored rule references, including namespaces and selector URLs. Compare a seeded
admission model with the real normalizer on derived fragments, then compare
seeded compiled catalogues with the text oracle; print seeds on failure.

Prove normalization/string-hash compatibility, retained references and bounded
seam windows and material consumers. Pin exact material/normalization bytes,
fingerprint bytes/hash counts and fingerprinted views for resolved, skipped and
owned fixtures, including digest reuse. Guard/counter mutations must fail tests.
Catalogue replay must agree with the original same-mode outcome, not just with
another replay, and pin coverage. Name any independently confirmed pre-existing
path divergence excluded from that replay; an exclusion is not a passed pair.

## Source Proof Reuse

Original flat validation stays eager, including region pairing and material-signal
errors. Reuse its validated signal keys; derive the material-id set, signal spans
and component-marker inventory only on demand. A regions-only caller derives no
signal inventory. Settled identical/non-identical quick checks and the style route
request no fingerprint-only data and add no source-safety scan.

Proof caches belong to one compared view and are allocated only for complete-path
work. Marker indexes share exact original source text. Style indexes additionally
require the same ordered skipped outer sources. Occurrence results additionally
require identical eligible start/end positions; equal text with different eligible
copies cannot share a result. Snapshot keys and never retain this cache across views.
All existing bounded seam checks and their counts still run for each recipe.

A successful quick source-safety check may record its ordered outer-source/content
inputs only when that quick attempt falls through. Skipped analysis may reuse it
only when both sides' exact ordered guard inputs match and both `useFastPath` and
`useStylePath` remain enabled. Missing proofs, either disabled switch and resolved
analyses run the existing guard. The guard's rules and the style route are unchanged.
Settled shortcuts allocate no proof snapshot; caching never adds a shortcut scan.

Test per-view shortcut paths with signals outside styles, eager error equality,
source/index/occurrence sharing and different eligibility. Count source guard scans
across all switch settings and missing/changed proofs. Keep the text oracles, seeded
catalogue/seam/occurrence proofs and guard mutations; caching cannot admit a view
that the uncached guards reject.

## Skipped Style Equality

In-place fingerprints must not distinguish an eligible style from identical text
left in an instance, caller slot, ignored region or any other context. Search each
side's original text with `indexOf` for each distinct skipped outer source; every
occurrence, including overlaps, must start at an eligible span of that same source.
Otherwise keep text for the whole view. These source scans do not build materials.

Each eligible element's delivered text must also equal its original outer source.
Keep the whole view on text if any original piece removed or replaced by the
recipe intersects an eligible outer span, on either side: component markers
(including tag-attribute text removed by `stripComponentMarkers`), review/ignore
markers, material signals and the generated header. Use the existing original
span inventory, without rewriting the sheet to test identity.

Original occurrences alone do not suffice. Removing literal component markers
inside an owned style can assemble a new identical outer source. On skipped
analyses, reject a kept `<style` at material position `p` and a kept ending of
the **same** skipped source `S` at `p + |S| - 12` in different pieces. Match the
prefix ASCII case-insensitively and the last 12 UTF-16 units of `S` exactly.
Use cumulative piece lengths and indexed original positions, without a text scan.
Coalesce adjacent original spans first; whole sources in one piece are safe.
Keep both bounded window checks for prefixes/endings that cross a seam, including
closing-tag attributes, across the same raw/single/pair recipes as the marker
guard. Skipped inserts have no style appendix. Their complete
producer comments and caller-slot wrappers contain no `<style`; their only `>`
is the closing one, so an inserted ending needs a bounded `endsWith` check and
the same exact material-position equality. Indexes are reused; queries inspect
numeric offsets and bounded text, never a sheet-sized piece's contents. Signature
comparisons scale with the distinct source lengths/endings and indexed prefixes.

A new exact style copy must cross a seam inside its outer source. Either its
opening prefix/ending crosses a seam, or both stay whole at exactly `|S| - 12`
apart in different pieces. The two window checks and index check cover these cases.
Eligible-only copies across instances and interleaved CSS-in-JS sheets keep their
fingerprints. Test compiled instance, renamed-key, slot, paired-region, tag-rewrite
and joined-copy cases with all fast/style switches; guarded materials stay verbatim.
Compare seeded recipes against brute-force material occurrence/seam scans. After
indexing, spy on string search/slice and regexp operations over 1 MiB pieces;
out-of-window reads must fail, including mutations that rescan queried pieces.
Record RNW, design, replay and interleaving coverage before/after changes.
