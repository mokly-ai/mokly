# Comparison Material Work Counts

These delivered M9 integer fields extend `review.document-work` under
[timings](./mokly-timings.md#component-analysis-counts). Collection is opt-in,
view/classification scoped and contains no document text, hashes or paths.
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

Material-normalization scope nests synchronously and restores on failure.
These counts describe actual work, including attempted work before an error.
They neither select a comparison path nor alter cache, resource or validation
policy. Construction and digest times retain their existing exclusive fields;
fingerprint hashing belongs to `hashMs`, recipe seam proof to `normalizationMs`,
and the remaining inline material preparation to `inlineRuleMs`.

For growing eligible cumulative sheets, completed fingerprint material lengths,
their normalization inputs and downstream string-hash inputs stay bounded.
Fingerprint input bytes necessarily grow with the sheet and remain visible
separately. Complete preparation derives ignore pairing from validated original
metadata without normalizing the whole source. A preceding non-identical quick
attempt may still normalize originals; that is separately counted source work.
The style-only route constructs no page material and computes no fingerprints.

This is a work-bound proof, not a constant-time claim about source validation,
HTML parsing, CSS preparation, matching or the fingerprint's own digest input.
All materials and consumers remain strings under the
[fingerprint contract](./mokly-page-analysis.md#fingerprinted-materials).
