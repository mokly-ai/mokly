# Style-only Route Supervisor Checkpoint

This follow-up to [the M8 checkpoint](./style-only-route-checkpoint.md) starts at
`b76a2a90` on `calummoore/irvine-v6`. The task-start host is Intel Xeon @ 2.90GHz,
2899.930 MHz. This is a local code checkpoint: no measurements, fixture benchmark
regeneration, push, final implementation review or next milestone.

The [second supervisor checkpoint](./style-only-route-second-checkpoint.md)
records follow-up source/escape and resource-proof corrections after `563de1e5`.

## Corrections

1. Raw edited-style reference arrays must agree before the route trusts shared
   seeds. The raw detector sees selector-argument URLs that stored full-rule
   references omit. Derived proof checks base seed existence through the optional
   reader before required traversal; absence returns fallback. The regression
   covers an added head-only URL, a missing unchanged seed, and unequal raw
   seeds with both resources present. Existing head-only committed traversal and
   independent derived closure/membership/byte checks remain.
2. Both identical and non-identical quick checks reject resource records within
   eligible style outer spans when paired-ignore or removed spans drop them.
   Source records and spans suffice; no successful quick check analyzes CSS.
   Tests cover CSS comments, tag attributes and removed component markers, with
   changed asset evidence in both modes. The extra non-identical case first
   reproduced the same bug behind an unrelated outside ignored-content edit.
3. Any review-marker prefix in eligible start/end tags forces route fallback.
   Both paired markers in unchanged tags plus an external signal now preserve
   the full path's missing-region error. Validation and full materials are unchanged.
4. The supervisor chose **option B**, superseding the implementer's option A
   recommendation. Non-identical quick checks and the route reject any paired
   ignore region or either marker intersecting an eligible style's outer span.
   Original flat spans own validation, pairing and content recording; canonical
   actual materials remain authoritative for state and emitted ignore ids.
   A comment-only edit inside eligible style content returns `unchanged`, `[]`
   through full comparison. Tests cover all switch combinations, unchanged style
   regions, regions across styles, markers in tags and ordinary outside regions.
   The outside-region and textarea controls keep `fast` / `ignored-only`.

The reserved `<!--mokly-` guard remains the earlier supervisor-approved contract
gap fix: original eligible content and all four composed appendices are checked.
Its approval history was removed from normative condition 5 and retained in the
plan and checkpoint reports. No Decision or complete-path result changes.

The dead tag-slice comparisons were removed. The base content bound was also
redundant: equal window starts and the suffix displacement make it identical to
the head content bound. Region/window overlap is now covered by the stronger
whole-element paired-ignore check; material-signal window checks remain.
`style_source_safety.ts` shares the source proof without requiring a base tree
on the route. Existing complete comparisons still reuse prepared runs and analysis.

## Guard Proofs

Per-view tests cover base-only `<` and raw end tags; distant start/end-tag
attributes; original-content-only comments and excluded rules; head-only and
base-only serialization-produced prefixes; paired-ignore windows in tag
attributes, with and without an external signal; material signals; and unresolved
`&`, `:is()` and `:where()` selectors. Stage-level span assertions isolate guards
that later reserved-prefix checks would otherwise hide. Fallback tests explain
why they disable the preceding quick check.

The cumulative RNW classifier now asserts its actual production timing record:
64 views, 64 style, 0 fast, 0 complete, independently in each mode. A production
view batch asserts 2 views, 1 style and 1 complete; neither uses the test helper's
manual `comparedView` call for these counts. The existing seeded differential
retains seed `0x8c51a7`, 320 edits in each mode and marker lookalikes.

All **15 mutations were rejected**, after a passing baseline on the same test
files. Each mutation changed one guard in built production code, ran its focused
tests, then restored the original file byte-for-byte. No mutant changed authored
source. `m8-supervisor-mutations.py` defines the exact edits;
`m8-supervisor-mutations.json` records their names, test files, failures and
original hashes; `m8-supervisor-mutant-<name>.log` retains every run.

| Mutation                  | Regression that rejects it                                          |
| ------------------------- | ------------------------------------------------------------------- |
| `base-less-than`          | Base-only end tag and plain `<`, both modes                         |
| `original-content-prefix` | Edited comment, excluded rule, unchanged comment                    |
| `head-composed-prefix`    | Head-only serialized prefix                                         |
| `base-composed-prefix`    | Base-only serialized prefix                                         |
| `content-bounds`          | Distant type/data and end-tag attributes                            |
| `route-paired-ignore`     | Condition-3 stage check for a content region outside the window     |
| `paired-ignore-predicate` | Tag-bounded windows, with/without signal, plus quick-check variants |
| `review-tag-prefix`       | Material marker in a tag with its region outside styles             |
| `material-window`         | Stage check before the later content-prefix guard                   |
| `selector-failure`        | All three unresolved selectors, both modes                          |
| `production-style-count`  | Production RNW classification and the mixed batch                   |
| `raw-reference-values`    | Unequal raw seeds with both assets present                          |
| `missing-base-seed`       | Missing base seed without changed-path evidence                     |
| `dropped-reference`       | Identical and non-identical dropped-source references               |
| `quick-paired-ignore`     | Ignored edits in content, across styles and tag attributes          |

The broader paired-ignore proof subsumes the earlier window/region overlap
check. Its direct predicate/stage assertions prevent the independent tag and
reserved-content fallbacks from masking missing coverage.

## Regression-first Evidence

All evidence is under `.context/delegation/scalable/`, including:

- `m8-supervisor-regressions-before.log`: all four reported defects fail before
  implementation changes (4 passing tests; 25 failures including parent tests).
- `m8-supervisor-nonidentical-reference-before.log`: the additional non-identical
  dropped-reference regression fails in both modes (6 pass, 4 including parents fail).
- `m8-supervisor-ignore-proposal.md`, `m8-supervisor-ignore-evidence.test.ts` and
  its `.log`: the original decision proposal and two failing equality assertions;
  the supervisor's B resolution is appended without replacing that evidence.
- `m8-supervisor-regressions-after.log`: the initial fixed targeted run passes
  235 tests, including the 640-case seeded differential and textarea cases.
- `m8-supervisor-guards.log`: the initial isolated guard/count run passes 46 tests.

## Verification And Checkpoint

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
The final targeted command passes **673 tests**, including page-analysis and
M6 material/reference differentials, all route tests, fast-path tests and
protocol checks. Typecheck, Prettier, ESLint, repository ratchets, Rust formatting,
Clippy, all 11 Rust tests and the nine-file Rust length audit pass. Evidence uses
`m8-supervisor-{targeted,typecheck,format,lint,ratchets,rust}.log`.

All full suites passed on October 3, 2026, with no retries, failures, skips or
cancellations. Both browser projects used `PLAYWRIGHT_CHANNEL=chromium`. The
previous checkpoint's keyboard-scroll timeout passed normally; no timing
exception, timeout edit or UI change was needed.

| Suite     | Result                                                                                               | UTC interval | Evidence prefix             |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------ | --------------------------- |
| Package   | Build, typecheck, example, package validation and all five consumer scenarios for both packages pass | 14:08–14:10  | `m8-supervisor-package.log` |
| Unit      | 3,757 / 3,757 pass                                                                                   | 14:10–14:24  | `m8-supervisor-unit`        |
| Browser   | 725 / 725 pass                                                                                       | 14:24–14:50  | `m8-supervisor-browser`     |
| Hydration | 219 / 219 pass                                                                                       | 14:50–15:07  | `m8-supervisor-hydration`   |

The last three prefixes have `.json` and `.log` reports.
`m8-supervisor-verification.json` records exact commands, timestamps and exits.
`m8-supervisor-frozen-files.json` hashes all authored files, including new files;
each full suite's post-check confirmed no changes. Only this report and plan
completion bookkeeping changed after the suites, followed by Markdown checks.

The exact full-suite commands were run serially with the following environment:

```sh
for suite in package unit browser hydration; do
  PLAYWRIGHT_CHANNEL=chromium \
  MOKLY_VERIFICATION_REPORT=".context/delegation/scalable/m8-supervisor-$suite.json" \
  npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite "$suite"
done
```

Targeted and static commands (all passed):

```sh
npm exec --yes --package=node@24.19.0 -- node --import tsx --test \
  tests/component_style_*.test.ts tests/page_quick_style_references.test.ts \
  tests/page_analysis_*.test.ts tests/component_fast_path*.test.ts \
  tests/component_protocol_docs.test.ts tests/protocol_doc_sizes.test.ts \
  tests/protocol_doc_history.test.ts
npm exec --yes --package=node@24.19.0 -- npm run typecheck
npm exec --yes --package=node@24.19.0 -- npm run format:check
npm exec --yes --package=node@24.19.0 -- npm run lint
npm exec --yes --package=node@24.19.0 -- node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo xtask rust-file-length-lint --all
```

The unqualified `cargo xtask check` and measurements remain after supervisor
approval, under the brief's checkpoint order. The known unpatched `braces`
audit blocker is unchanged; no dependencies, overrides or gates were modified.
No combined-gate pass or new audit result is claimed at this code checkpoint.

The deletion audit adds no removals relative to `b76a2a90`. The 317 direct-tree
absences relative to current `origin/main` are byte-identical to the starting
checkpoint's deletion inventory; newer main integration remains M10 work.
`m8-supervisor-{main-status,main-deletions,starting-main-deletions,checkpoint-deletions}.txt`
retains the audit. New authored source/tests/docs are included in the checkpoint
commit; `.context/` and ignored generated output remain excluded.

M7 bookkeeping now records the supervisor's October 3 push of `96ddc06c` under
the user's instruction to continue all milestones, with the audit blocker in
commit bodies. The user's audit-exception decision for merging to `main` remains
open. M8's measured/push/review TODOs remain open.
