# Fingerprinted Materials: Second Supervisor Follow-up

This follows the supervisor check of `f183ac67`. It preserves delivered text
equality when a skipped style also occurs outside eligible spans, and removes
unreachable branches from the seam proof. This is a local checkpoint: no M9
scale measurements or push. Evidence is under
`.context/delegation/scalable/m9-round2/`.

## Skipped Copies And Equality

`skipped_style_occurrences.ts` groups skipped elements by complete original
outer source, then uses `indexOf` to find every occurrence on each original
side, including overlapping starts. Every occurrence must start at an eligible
span of that same source. Otherwise the whole view retains delivered text on
both sides, actual and projected. It does not parse another document.

The four compiled fixtures cover paired instances, renamed instance keys,
caller slots and paired ignored regions. Before the fix, all eight mode/case
tests failed after comparing all four fast/style settings (12 reported failures
including parent tests). All now equal the text oracle, including exact prepared
materials and references. In the region case the text oracle is `unchanged`
with recorded `ignoredIds` `["a", "b"]`; the fingerprint bug changed the state
to `ignored-only`. The delivered oracle is retained without changing that id
rule. An eligible-only duplicate control keeps two in-place fingerprints in
each material. Separate before-only/after-only textarea copies isolate the
original occurrence guard from every seam guard.

### The Seam Theory Check

Existing marker guards did **not** exclude all newly assembled copies. A real
compiled component can render an owned style with literal component comments
inside its CSS; stripping those comments makes it identical to a skipped
eligible style. Moving that eligible style across the instance returned
`unchanged` in text but `changed`/`material` with fingerprints, in all eight
mode/switch combinations. `occurrence-seams-before.log` retains this failure.

The skipped-style seam proof now conservatively rejects a seam between a kept
`<style` prefix and a later exact 12-unit ending of a skipped outer source, or
crossing either boundary.
Original prefix/ending offsets are indexed once per used side and reused for
all recipes; splits use the existing 12-unit windows. If a new exact outer
source crosses a seam, its opening prefix or ending crosses a seam, or both
remain whole on opposite sides of one. Skipped inserts contain no opening prefix. Their closing `>` is
their only `>`, so a bounded `endsWith` check covers an inserted ending. This
check is exercised through a real compiled caller-slot wrapper too. No material
string or sheet-sized window is built.

This can also reject seams between separate styles; it intentionally makes no
HTML-context assumption about literal bytes. The fixture coverage below is
unchanged. The contract states this conservative rule and its proof in
[material work counts](../protocol/mokly-material-work-counts.md#skipped-style-equality),
linked from the 250-line [page-analysis contract](../protocol/mokly-page-analysis.md#fingerprinted-materials).

A follow-up proof check found that using only `</style` missed seams after the
closing-tag name. A compiled textarea copy and a closing-attribute unit test
failed first (`closing-seams-before.log`); the bounded exact ending closes that
gap. The first verification run was stopped before editing; the final frozen
run restarts every suite. The interrupted evidence remains in `first-verification/`.

Seed `0xf19e79` now covers 80 compiled catalogues (640 switch/mode comparisons),
including all four occurrence shapes, the owned-marker join and closing-tag
joins. Guarded cases also require exact text bytes/references. The 20,000-document guard-model seed
`0x9f71ab` passes the skipped/resolved state into the production seam proof.
Existing material/normalization/hash bounds and the 24-unit seam limit remain
covered. A focused source-index test also checks one-MiB retained pieces.

## Reachable Seam Proof

Removed `incoming` from `MaterialMarkerOffsets.openAfter`: an open source
marker has already forced fallback at the next seam. Removed `closedInserts`,
insert scanning and the default source index from `fingerprintAtSeam`; callers
provide the original side's cached index. Appendix comments, placeholders,
contract tokens and wrappers are complete markers/tags by construction.

Direct tests no longer supply unfinished marker inserts or inherited open
state that production cannot reach. They retain source-piece opener/close,
partial-name, whole-marker and closed-insert controls. The first follow-up
report now explicitly identifies its insert-opener mutation as test-only,
not production protection, and includes the previously omitted anchor mutation.

## Mutation Evidence

Every compiled mutation was restored byte-for-byte. `mutations.json` records
exact commands and exits; counts include parent tests when Node reports them.

| Mutation                                    | Failing tests |
| ------------------------------------------- | ------------: |
| Remove base original-occurrence guard       |             1 |
| Remove head original-occurrence guard       |             1 |
| Reject eligible-only copies                 |             1 |
| Remove indexed style-interior seam check    |             9 |
| Remove crossing style-opening prefix check  |             1 |
| Remove crossing skipped-source ending check |             1 |
| Remove bounded inserted-ending check        |             4 |
| Ignore open source-marker state             |             3 |

The initial compiled occurrence regressions are in `occurrences-before.log`;
the joined-copy failure is in `occurrence-seams-before.log`. Initial focused
passes are in `occurrences-after.log` and `seeded-and-work.log`; the final
`targeted.log` also covers closing-tag joins, inserted endings and all 80
seeded catalogues.

## Coverage Before And After

| Fixture                                    |  Before |   After |
| ------------------------------------------ | ------: | ------: |
| RNW default, no change, each mode          |   64/64 |   64/64 |
| RNW default, component style, each mode    |   64/64 |   64/64 |
| RNW cumulative, no change, each mode       |   64/64 |   64/64 |
| RNW cumulative, component style, each mode |   64/64 |   64/64 |
| Design catalogue, each mode                | 428/428 | 428/428 |

These are forced-complete fingerprinted-view counts, with text-oracle equality.
The eight RNW samples still total 512 fingerprinted views and 784 hashes.
`rnw-before.json`, `rnw-after.json`, `design-before.json` and `design-after.json`
retain the samples. They are correctness coverage, not performance measurements.
Optimized RNW fast/style counts and the pinned 7,844-view catalogue replay run
again in the broader targeted suite. The named pre-existing alias exclusions
remain unchanged, as do all unapproved M8 review findings.

## Verification

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
Browser and hydration use `PLAYWRIGHT_CHANNEL=chromium`.
The host reports Intel Xeon 2.90 GHz, 2899.962 MHz and eight CPUs (`host.txt`).

| Command / suite                                               | Result                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Targeted suites (`targeted-command.json`)                     | 1,698 passed; no skips/cancellations                    |
| `cargo xtask check --suite package`                           | Passed; both packages, all five consumer scenarios      |
| `cargo xtask check --suite unit`                              | 4,788 passed; zero skips/cancellations                  |
| `cargo xtask check --suite browser`                           | 725 passed on pinned Chromium; zero skips/cancellations |
| `cargo xtask check --suite hydration`                         | 219 passed on pinned Chromium; zero skips/cancellations |
| `npm run typecheck`                                           | Passed                                                  |
| `npm run lint`, `npm run format:check`                        | Passed                                                  |
| `node scripts/verification/repository-ratchets.mjs`           | All four ratchets passed                                |
| `cargo fmt --all -- --check`                                  | Passed                                                  |
| `cargo clippy --workspace --all-targets -- -D warnings`       | Passed                                                  |
| `cargo test --workspace`                                      | 11 passed                                               |
| `cargo xtask rust-file-length-lint --all`, `git diff --check` | Passed                                                  |

`verify.py` records exact commands, times, exits and authored-file hashes in
`verification.json`. All 13 final checks exited successfully with no authored-file changes; both
Playwright reports have zero skips/cancellations. Only this report and the plan
were finalized afterward, with Markdown formatting, line-cap and diff checks
repeated. The full driver exited zero. A test-import ordering correction was
verified by this final run; its earlier lint output is retained separately. Mainline deletion audits
retain the starting inventory of 345 pre-existing direct-tree absences, with no
new deletions. The M8 style route and `style_source_safety.ts` are unchanged.

The combined `cargo xtask check` and push remain after supervisor-approved M9
measurements, per the brief. The known `braces` audit blocker is unchanged; no
dependency, override or verification gate is modified. The existing M9
measurement plan and user-owned audit/alias decisions remain open.
