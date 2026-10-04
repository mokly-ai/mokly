# Fingerprint Guard Gap: Normalization Creates A Reserved Prefix

Milestone 9 builds on `5e5111dc`. The supervisor approved option A below as a
contract-gap fix: check bounded windows at every delivered material seam before
admitting fingerprints. The original reproduction and rejected alternative
remain here as evidence. M8 findings are recorded verbatim in the plan, with its
review TODO ticked. Neither `style_source_safety.ts` nor the route was changed.

## Finding

1. **Medium: the original-text prefix guard does not protect skipped-style
   fingerprints from prefixes created by ignore normalization.** A real renderer
   fixture compiles and validates in both modes. Neither original contains
   `mokly-inline-`, and its equal reference-free style sources skip analysis.
   Normalization then produces an authored comment equal to the inserted style
   fingerprint. Moving the style past that authored comment loses its material
   change. This requires no SHA-256 collision.

   For style source `<style>.entry{color:red}</style>`, the digest is
   `r86yXCdBB3jKy0Bufy5ngdhdmtBA-XkPFQ8tODhBaVg`. Let `S` be that style,
   `D` its digest, and `F` this authored fragment:

   ```text
   <!--mokly-in<!--mokly-review-ignore:start:clock-->line-style:D--><!--mokly-review-ignore:end:clock-->
   ```

   Base contains `S + F + materialSignal(clock, "a" repeated 64)`; head contains
   `F + S`. Both have the region, but only base has its material signal, so the
   existing one-sided-adoption rule keeps the content and removes the boundary
   comments and the one-sided signal. `F` becomes `<!--mokly-inline-style:D-->`.

   Text materials retain `S + fingerprint-lookalike` versus
   `fingerprint-lookalike + S`. Fingerprinted materials reduce both to two
   identical comments. The existing M8 guards inspect eligible styles; this
   fragment is outside them. It is related to the broader join concern in M8
   finding 2, but the reproduced join here is caused by ignore normalization.

   | Comparison               | State          | Material | Entry reasons | Ignored ids |
   | ------------------------ | -------------- | -------- | ------------- | ----------- |
   | Delivered text oracle    | `changed`      | `true`   | `material`    | `[]`        |
   | M9 fingerprint prototype | `ignored-only` | absent   | none          | `[]`        |

   Every combination of `useFastPath`/`useStylePath` reaches `complete` and
   reproduces this mismatch in committed and derived modes. The renderer is
   actually compiled; this is not a hand-built classifier result.

## Original Proposal

- **A — recommended: extend M9's whole-view fallback to prefixes that can be
  created by material rewrites/normalization.** Check potential joins across
  component/ignore boundary removal, material-signal removal, eligible-style
  removal and copied source pieces, using the existing source spans. A streaming
  check can avoid constructing or normalizing sheet-sized text just to make the
  guard decision. Any possible authored `mokly-inline-` keeps both sides' actual
  and projected materials on the delivered text path. Update the fingerprint
  contract and add split-prefix/one-sided-adoption differentials and work bounds.
  This is a M9 guard change; it does not authorize M8 route/quick-check fixes.
- **B — defer skipped-style fingerprinting.** Retain delivered text when inline
  analysis is skipped, while keeping the successful-rule fingerprint work.
  This avoids this collision but loses the planned bound for ordinary complete
  views with unchanged cumulative sheets, so M9's contract/scope must change.

A protects the normalization-join class instead of adding a check for this
single spelling. The exact guarded transformation domain needs approval before
implementation; the current original-only rule cannot establish its claimed
authored-lookalike guarantee.

## Original Evidence

Failing regression under `tests/`: `tests/material_fingerprint_prefix_join.test.ts`.
It verifies absent original prefixes, skipped analysis, the complete text result
and equality under all four switches in each mode. Evidence is under
`.context/delegation/scalable/m9-checkpoint/`:

```sh
npm exec --yes --package=node@24.19.0 -- node --import tsx --test tests/material_fingerprint_prefix_join.test.ts
```

- `prefix-join-probe.test.ts`, `prefix-join-probe.log` and
  `prefix-join-{committed,derived}.json` retain the reproduction and all four
  actual/projected material strings on each path.
- `prefix-join-regression-before.log` records all eight failing per-view
  comparisons (ten failures including parent tests).
- `oracle-baseline.log`: ten pre-fingerprint checks pass against the captured
  M8 renderer. `fingerprints-after.log`: 24 initial material checks pass.
- `marker-differentials.log`: 734 M8 marker/guard regressions pass against both
  material paths. `work-after.log`: 18 work/route/normalization checks pass.
- `catalogue-differentials-snapshot.log` / `catalogue-corpus.json`: 32 test files,
  260 real catalogue inputs, 520 committed/derived pairs and 3,528 fingerprint
  hashes pass. The expanded replay of all inline/CSS/Changes test files still
  needs a harness adjustment: its supplementary reads affect an existing batch
  read-count assertion. That is separate from this material mismatch.

Formatting and TypeScript checks pass (`proposal-format.log` and
`proposal-typecheck-retry.log`); the initial typecheck's test typing errors were
corrected. The implementation includes the text oracle switch, reference-preserving
fingerprints, original-metadata ignore pairing and separate material/fingerprint
work counters. At the time of the proposal, the prototype and tests were
uncommitted; full unit, browser, hydration, static verification and the code
checkpoint had not run. The
[checkpoint report](./fingerprinted-materials-checkpoint.md) records completion.

## Approved Resolution

The supervisor approved A with an exact streaming rule. Match `mokly-inline-`
case-sensitively in the original texts and across every delivered recipe seam,
using only the last 12 UTF-16 units before and first 12 after each seam. Windows
cross adjacent tiny pieces and inserts. The recipes cover actual/projected
source and caller copies, component-marker stripping, single/pair ignore
normalization, one-sided material adoption, style removal, placeholders,
contract tokens and wrappers. An unprovable derived marker structure retains
text materials and their validation. No route or quick-check behavior changes.

Option B was rejected: it would not close the class because a joined authored
lookalike can also equal the appended rule fingerprint.

The eight per-view reproduction comparisons now equal the text oracle: `changed`,
`material`, material reasons and no ignored ids. Component, material-signal,
style-removal, caller-copy and multi-seam regressions pass. A 1 KiB versus 1 MiB
source test reads exactly 24 code units for the same seam; N versus N+1 complete
comparisons keep material, normalization and consumer hash work constant.

The expanded replay's supplementary-read issue was fixed only in its harness.
Before and after the seam guard, the 92-file replay covers 382 catalogue inputs,
764 mode pairs, 7,844 fingerprinted views and 12,472 fingerprint hashes. The small
React Native Web fixture cases retain 64/64 fingerprinted complete views each
(512 views and 784 hashes total); ordinary optimized runs retain 64/64 fast
no-change views and 64/64 routed component-style views. Evidence remains under
`.context/delegation/scalable/m9-checkpoint/`, including `corpus-{before,after}-seam.json`,
`rnw-{before,after}-seam.json`, `seam-final-targeted.log` and
`route-hash-probe-fixed.log`. The checkpoint report records final verification.
