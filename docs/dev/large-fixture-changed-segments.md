# Changed-Segment Analysis Checkpoint

## Provenance And Method

Milestone 5 measured code `a78b611352f850ac212ddd4de93b621a4104a374`
(`moklyDirty: false`), after its targeted, unit, Chromium, hydration and static
checks. Node 24.19.0; Amazon Linux x64; Intel Xeon 2.90 GHz; eight CPUs;
16,643 MiB RAM; no swap. Each matrix ran alone with `nohup`; process, memory
and load observations bracket each run. No tracked files changed while measuring.

Both committed fixtures retain the Milestone 2 identity: 30 areas, 40 screens,
12 rows, four shared sheets, share 0.5; 1,590 entries and 5,550 documents.
`templateDigest` is
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Prepared code is `4b09b13e6b537b1c02278bfbefd75e62b85f8af5`, clean.
Default/cumulative fixture commits are respectively
`8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22` and
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
Rendering dependencies: React/React DOM 19.2.7, React Native Web 0.21.2,
Firna 0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0,
css-what 8.0.0. No regeneration or template change was needed.

Commands: `npm run benchmark:large -- --scenario no-changes --scenario component-style`
and the same command with `--inline-styles`. Each requested cold/warm sample
is retained. Both matrices exit 1 for usable-startup budgets, not classification
failure. Both fixtures finish restored to setup: only the intentional unused
`shared-1.css` rule differs from their Git baseline.

| Matrix     | UTC interval, 2026-10-01 | Free MiB before/after | Available MiB before/after | Uptime before/after | Load before → after (1/5/15 min) |
| ---------- | ------------------------ | --------------------- | -------------------------- | ------------------- | -------------------------------- |
| Default    | 21:18:31–21:30:21        | 12093 / 11669         | 15242 / 15032              | 11:58 / 12:09       | 0.08/0.30/1.10 → 1.45/1.74/1.56  |
| Cumulative | 21:32:01–22:26:15        | 11807 / 11672         | 15168 / 15080              | 12:11 / 13:05       | 0.34/1.25/1.40 → 1.09/1.86/2.28  |

## Results

Times are completed background-worker milliseconds; heap is sampled isolate
heap, not RSS. All eight outcomes are `ok` with exact expected membership:
empty for no-change and only `area-1-action` for component-style.

| Fixture    | Scenario        | State | Classification ms | Heap MiB | Usable ms | Fast / complete views |
| ---------- | --------------- | ----- | ----------------- | -------- | --------- | --------------------- |
| Default    | no-changes      | cold  | 35143.25          | 191.55   | 4758      | 5520 / 0              |
| Default    | no-changes      | warm  | 33940.58          | 207.56   | 4772      | 5520 / 0              |
| Default    | component-style | cold  | 41698.02          | 197.80   | 5012      | 5336 / 184            |
| Default    | component-style | warm  | 36132.87          | 181.58   | 5657      | 5336 / 184            |
| Cumulative | no-changes      | cold  | 167385.44         | 227.97   | 4808      | 5520 / 0              |
| Cumulative | no-changes      | warm  | 168346.56         | 305.16   | 4911      | 5520 / 0              |
| Cumulative | component-style | cold  | 574947.44         | 243.87   | 4677      | 0 / 5520              |
| Cumulative | component-style | warm  | 522469.10         | 240.18   | 5084      | 0 / 5520              |

Both cumulative style samples now complete within the delivery ceiling, unlike
Milestone 4's incomplete cold sample. Warm classification falls from
587185.73 to 522469.10 ms (11.0%); exclusive inline-rule work falls from
234140.05 to 138205.02 ms (41.0%). These are separate checkpoint runs, not
an interleaved causal comparison. HTML construction remains the largest cost.

## Work Attribution

The document-work fields below are exclusive operation totals, not inclusive
spans. They cannot be added to inline-analysis interval unions.

| Fixture/scenario/state          | HTML parses | UTF-8 HTML bytes | HTML ms   | Inline-rule ms | Reference ms | Normalization ms |
| ------------------------------- | ----------- | ---------------- | --------- | -------------- | ------------ | ---------------- |
| Default/no-changes/cold         | 26520       | 566968795        | 19320.87  | 0              | 1530.03      | 3005.24          |
| Default/no-changes/warm         | 26520       | 566968795        | 19116.90  | 0              | 1500.28      | 3049.87          |
| Default/component-style/cold    | 27874       | 594185052        | 22138.78  | 273.94         | 2055.86      | 3553.06          |
| Default/component-style/warm    | 27874       | 594185052        | 20187.69  | 245.87         | 1569.95      | 3043.76          |
| Cumulative/no-changes/cold      | 26520       | 3306455349       | 115108.10 | 0              | 9227.97      | 16577.44         |
| Cumulative/no-changes/warm      | 26520       | 3306455349       | 112884.72 | 0              | 10126.69     | 17990.44         |
| Cumulative/component-style/cold | 66270       | 7868856736       | 324951.22 | 156708.08      | 23353.02     | 15011.61         |
| Cumulative/component-style/warm | 66270       | 7868856736       | 301963.38 | 138205.02      | 20758.52     | 13770.71         |

No-change parses ranges 15,840 times and references 10,680 times. Default
style parses ranges 16,048 times, references 11,090 times, discovery 368 times
and inline matching 368 times. Cumulative style parses ranges 22,080 times,
references 22,110 times, discovery 11,040 times and inline matching 11,040 times.
Every other parse step is zero. Full exclusive totals and remaining fields
are preserved in the JSON; uncounted remainder is not labelled CPU or I/O time.

| Scenario/fixture (each state) | Elements | Segments | Hits     | Parses | Fallbacks |
| ----------------------------- | -------- | -------- | -------- | ------ | --------- |
| no-changes, both              | 0        | 0        | 0        | 0      | 0         |
| component-style, default      | 736      | 56628    | 56468    | 160    | 0         |
| component-style, cumulative   | 11040    | 32447024 | 32441326 | 5698   | 0         |

Cumulative native reuse is unchanged: 5,698 distinct misses among 32.4 million
segment occurrences. M5 reduces residual rule analysis and composition, not
scanning every segment or constructing every page tree. Inclusive inline-analysis
shares are 49.13%/49.49% cumulative style and 3.15%/3.46% default style.

These are diagnostic single-run ratios, **not** Decision 13 acceptance:
cumulative style/no-change is 3.435 cold and 3.104 warm, above 1.25;
cumulative/reference is 5.011/5.017 no-change and 15.640/13.797 style, above 2.
Default/reference is 1.052/1.012 no-change and 1.134/0.954 style; two cells
exceed 1.05. Milestone 6 profiles these costs before page-work implementation.

## Feedback Fixes And Verification

- Mixed fallback/segmented element tests require full diff sizes `[4,3]` and
  `[3,4]`; a grouped case pins `entry`. An `&&` → `||` mutation fails all
  four tests, proving pair-wide fallback rather than accidental non-cancellation.
- Cached-rule Proxies at N = 10 and 1,000 count own-key enumeration: composition
  copies zero cancelled rules. A flatten/rebase mutation fails both tests.
- Removed test-only production adapters/getters and required reference indices;
  the M4 adapter now lives under `tests/helpers/`. The explicitly authorized
  `inline_rule_lists.ts` deletion is branch-only, not a mainline deletion.
- Actual canonical rules sort once per side; projected order filters that same
  sequence. A test first fails with four sorts and passes with two, while
  checking both resulting orders. The original differential TODO is restored
  with a separate note documenting only the approved exception domains.
- Node 24.19.0: 566 targeted/documentation tests, 3,151 unit tests, 725 Chromium
  tests and 219 hydration tests pass with no skips/failures. Build, example
  build/check, format, lint and root/viewer type checks pass. The complete
  `cargo xtask check` passes completely: 11 Rust, 3,151 unit, 725 Chromium
  and 219 hydration tests, plus repository, package and example verification.

The first final-gate attempt rejects an unused internal export. The canonical
sorter is made private (its callers are in the same module), then 501 targeted
tests and complete verification pass again. This later visibility-only change does not
alter analysis operations or fixture inputs; measurements remain attributed to
`a78b6113`, not relabelled as the later evidence commit. M6 measures the resulting
committed tree again with its full matrices.

## Evidence

All paths are under `.context/delegation/scalable/`:

- `m5-default.{log,json,exit}`, `m5-cumulative.{log,json,exit}`;
  each stem also has `.machine-{before,after}.txt`, `.idle-processes.txt`,
  `.worktree-{before,after}.txt` and `.launcher.log`.
- `m5-{default,cumulative}.metrics.json`, `m5-metrics.log`,
  `evidence-summary.mjs`, `run-scale-evidence.sh`.
- `m5-feedback-{targeted,unit,browser,hydration,static}.{log,exit}`;
  `m5-fallback-mutation.log`, `m5-copy-mutation.log`.
- `m5-final-check.{log,exit}`, `m5-final-check-first.{log,exit}`,
  `m5-private-sort-{targeted,ratchets}.log` and the pre/post-push audit files.

The aborted default launcher stopped before any benchmark process or sample;
the subsequent real matrix is the only default measurement. A JSON extraction
error was repaired from its existing log without rerunning any sample.

See [parse reuse](./large-fixture-parse-reuse.md), the
[benchmark contract](../../tests/fixtures/large/benchmark-contract.md) and
[timing contract](../protocol/mokly-timings.md).
