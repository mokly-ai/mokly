# Fingerprinted Materials: Third Supervisor Follow-up

This narrow follow-up addresses the three findings on `1ca3099a`. It retains
text for rewritten skipped sources, restores fingerprints for interleaved
eligible styles, and tests actual string reads in the seam proof. No M9 scale
measurements or push were performed. Evidence lives under
`.context/delegation/scalable/m9-round3/`.

## Corrections

1. **Delivered-source identity.** `PageAnalysis.sourceEditsIntersect` reuses
   the original component/ignore marker, material-signal and generated-header
   spans. Any intersection with a skipped eligible outer span keeps text for
   the whole view on both sides, actual and projected. This prevents an original
   tag containing component-marker text from hashing differently from its
   delivered, stripped text. No extra parse or material rewrite tests identity.
   Paired and renamed instance swaps, plus paired-region swaps, are compiled
   regressions in both modes under all four switches, with exact text materials
   and references. All six mode/case regressions failed before the fix (nine
   failures including parents). A new seeded kind varies the same three shapes.
2. **Position-exact style seams.** The index retains each distinct source
   length with its own 12-unit ending. Cumulative piece lengths map original
   `<style` starts into material positions. A whole start at `p` and its same
   source's ending must appear at `p + |S| - 12` in different pieces to reject
   fingerprints. Source endings use indexed offsets; inserted endings use a
   bounded `endsWith` plus that same position equality. Adjacent original spans
   coalesce first. Both bounded crossing-window checks remain unchanged.
   The former broad before/after test and its unused boolean index queries are
   removed. Eligible styles across an instance, head/tail or head/entry styles,
   and emotion-like interleaving retain fingerprints. The distant caller-slot
   wrapper regression now requires fingerprints and oracle results instead of
   pinning its former conservative fallback.
3. **Observed bounded reads.** Index construction finishes before spies wrap
   string search/slice methods and `RegExp.exec`/`test`. The guards run on 1 MiB
   pieces; original-source reads must stay within their 12-unit edge windows,
   and assembled-window reads stay within 24 units. The test checks actual calls
   and restores every descriptor before assertions. A mutation performs a full
   piece slice and regexp search without changing the guard's result; the spy
   rejects it. The old size-only test now describes its offset/identity assertions
   rather than claiming to prove the absence of scans.

The [page-analysis contract](../protocol/mokly-page-analysis.md#fingerprinted-materials)
and [work-counts proof](../protocol/mokly-material-work-counts.md#skipped-style-equality)
state both the delivered-source requirement and the position-exact rule.
The page-analysis document remains within its 250-line cap. Source guides are
updated; the M8 route and `style_source_safety.ts` remain unchanged.

## Seeded And Mutation Proofs

Seed `0xa190c3` checks 12,000 recipes with multiple removals, inserts, caller
copies, adjacent identical styles and markers. Its independent oracle builds
the actual material, locates complete `S` occurrences and counts those crossing
non-adjacent joins. Every crossing must be rejected. All 2,000 adjacent-style
controls are admitted. Separate cases pin same-source length/ending pairing and
inserted endings at the wrong position. Failure labels include the seed and trial.

The compiled catalogue seed `0xf19e79` now builds 84 catalogues and compares
672 switch/mode outcomes, including the new tag-rewrite kind and exact guarded
bytes. The existing 20,000-document normalization model also runs. These are
correctness and work proofs, not benchmark samples.

Every mutation was restored byte-for-byte. `mutations.json` records exact
commands, exits and per-mutation logs. Counts include parent tests when reported.

| Mutation                                                      | Failing tests |
| ------------------------------------------------------------- | ------------: |
| Remove delivered-source identity guard                        |             9 |
| Treat touching spans as intersecting                          |            13 |
| Remove indexed crossing check                                 |             1 |
| Move required ending position by one                          |             2 |
| Omit cumulative material offset                               |             1 |
| Admit an ending in the prefix's own piece                     |             1 |
| Mix another source's ending with this length                  |             1 |
| Omit inserted-ending position equality                        |             1 |
| Slice/search whole retained pieces without changing decisions |             1 |

`regressions-before.log` records all 26 initial failures: nine tag-rewrite and
17 interleaving tests (parents included). `bounded-reads-before.log` passes the
original indexed implementation; `scan-mutation-before.log` fails the scanning
replacement before the production changes. `regressions-after.log` and
`seeded.log` retain focused passes; the final `targeted.log` covers every change.

## Fingerprint Coverage

| Complete-path sample                           |  Before |   After |
| ---------------------------------------------- | ------: | ------: |
| RNW, each of eight fixture/scenario/mode cases |   64/64 |   64/64 |
| Design catalogue, each mode                    | 428/428 | 428/428 |
| Included catalogue replay                      |   7,844 |   7,844 |
| Identical eligible styles around an instance   |     0/4 |     4/4 |
| Head and tail styles around an instance        |     0/4 |     4/4 |
| Head and entry styles around an instance       |     0/4 |     4/4 |
| Emotion-like body interleaving                 |     0/4 |     4/4 |

Each interleaving row covers both modes and both viewports. Tests assert the
fingerprinted-view count separately for each view, plus text-oracle outcomes.
`rnw-before.json`, `design-before.json` and `interleaving-before.json` are fresh
pre-change samples. `corpus-before.json` retains the preceding frozen `1ca3099a`
checkpoint's replay evidence. Final samples are `*-final.json`. The replay's
two named pre-M9 alias exclusions (four mode pairs) remain unchanged; excluded
pairs are not passing comparisons.

## Verification

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
Browser and hydration use `PLAYWRIGHT_CHANNEL=chromium`.
The verified host is Intel Xeon 2.90 GHz, 2899.962 MHz, eight CPUs (`host.txt`).

| Command / suite                                               | Result                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Targeted suites (`targeted-command.json`)                     | 1,732 passed; zero skips/cancellations                  |
| `cargo xtask check --suite package`                           | Passed; both packages, all five consumer scenarios      |
| `cargo xtask check --suite unit`                              | 4,822 passed; zero skips/cancellations                  |
| `cargo xtask check --suite browser`                           | 725 passed on pinned Chromium; zero skips/cancellations |
| `cargo xtask check --suite hydration`                         | 219 passed on pinned Chromium; zero skips/cancellations |
| `npm run typecheck`, `npm run lint`, `npm run format:check`   | Passed                                                  |
| `node scripts/verification/repository-ratchets.mjs`           | All four ratchets passed                                |
| `cargo fmt --all -- --check`                                  | Passed                                                  |
| `cargo clippy --workspace --all-targets -- -D warnings`       | Passed                                                  |
| `cargo test --workspace`                                      | 11 passed                                               |
| `cargo xtask rust-file-length-lint --all`, `git diff --check` | Passed                                                  |

`verification.json` records all 13 final commands, successful exits and empty
authored-file audits for the frozen full run. The driver exited zero. Only this
report and the plan were finalized afterward, with Markdown, line-cap and diff
checks repeated. Deletion audits retain the starting 345 pre-existing direct-tree
absences against main, with no new deletions.

Per the brief, combined `cargo xtask check` and pushing remain after approved
measurements under the known `braces` audit-blocker rule. No dependency or gate
was changed. The M8 findings and existing alias/audit decisions remain open.
