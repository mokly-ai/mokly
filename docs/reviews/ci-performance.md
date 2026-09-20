# CI Performance Measurement

This record measures the parallel CI implementation in
[PR #93](https://github.com/mokly-ai/mokly/pull/93). It separates workflow wall
time, runner consumption, queue delay, cache state, and dynamic test coverage so
an observed result is not replaced by a hypothetical queue-free time.

## Result

With restored caches and all downstream runner slots available, the workflow
completed in 9m07s and `Required CI` passed in 9m06s. Against the 32m43s
baseline, wall time fell by 23m36s, or 72.1%. Summed runner time rose from
65.667 to 84.133 minutes, or 28.1%.

| Evidence                                                                                              |   Wall | `Required CI` | Runner min | Peak jobs | Queue total / max |
| ----------------------------------------------------------------------------------------------------- | -----: | ------------: | ---------: | --------: | ----------------: |
| [Baseline](https://github.com/mokly-ai/mokly/actions/runs/35364820627)                                | 32m43s |        32m42s |     65.667 |         4 |          21s / 9s |
| [Empty-start attempt](https://github.com/mokly-ai/mokly/actions/runs/35394078749/attempts/1)          | 10m43s |        10m42s |     84.083 |        15 |       860s / 227s |
| [Restored, queued](https://github.com/mokly-ai/mokly/actions/runs/35394078749/attempts/2)             | 11m05s |        11m04s |     88.433 |        17 |       386s / 149s |
| [Restored, available capacity](https://github.com/mokly-ai/mokly/actions/runs/35394078749/attempts/3) |  9m07s |         9m06s |     84.133 |        20 |          80s / 8s |

The first two attempts missed the 6–10 minute target by 42s and 64s at
`Required CI`. They remain part of the result. No queue duration is subtracted
to claim an unobserved passing time. The third same-commit attempt started after
the competing main and release-please CI runs had completed and met the target
with the workflow's 20 downstream jobs able to run concurrently.

## Coverage And Evidence

The final frozen local `cargo xtask check` passed. Its unit report contains
1,855 passing tests in 352 files in 440.842s; its browser report contains 454
passing tests in 86 specs in 663.410s. Both report zero failures, skips,
cancellations, and reporter errors. The inventory retains all 344 unit files
and all 85 browser specs that existed before this change.

The source candidate was
`992c6a13db1b9a1d861b8b87a9014073dea5ec12`. GitHub tested synthetic merge
`9f8ed0ebf8a1b732ce31c7ed1ebcb520a8add98e`, combining that candidate with
`main` at `48af447ce2834bc4b03266066a2210845aab18c4`. Main had added tests after
the local gate, so every hosted attempt discovered 1,857 unit tests in 352 files
and 455 browser tests in 86 specs on each runtime.

All 22 jobs succeeded in each measured attempt. Every set of 16 shard reports
formed complete, disjoint inventories for Node 22.14.0 and Node 24.20.0 with no
failed, skipped, or cancelled tests. The production aggregate validator also
rejected seven altered evidence sets: a missing or duplicate report, a wrong
commit, failed or skipped evidence, a missing file, and a missing browser test.

## Cache And Runner Capacity

Before attempt 1, the four caches left by the earlier PR candidate were removed
and no `main` cache was present. The cache scope was empty at launch, but this
was not an all-jobs-miss run. Fifteen cache-using jobs missed; six jobs that
started later restored a Linux cache populated by concurrent Preview or earlier
work in the same workflow window. Attempts 2 and 3 each recorded 21 restores
and zero misses.

The empty-start attempt peaked at 15 jobs while older main and release-please CI
workflows were active. Its critical Browser Node 24 shard 3 queued 144s and ran
404s. Attempt 2 peaked at 17 jobs; its critical Browser Node 22 shard 3 queued
149s and ran 436s. Attempt 3 reached the
[GitHub Free limit of 20 standard hosted jobs](https://docs.github.com/en/actions/reference/limits),
and its critical Browser Node 22 shard 3 queued 8s and ran 442s.

The billing API reported zero billable milliseconds. GitHub documents that
[standard hosted runners are free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
so the summed runner minutes are a capacity and sustainability measure, not a
dollar charge. The parallel graph trades 28.1% more runner time for a 72.1%
wall-time reduction and is more exposed to shared runner queues.

## Shard And Fixture Measurements

The available-capacity attempt recorded these job and step ranges. Whole-job
time includes setup, the gate command, evidence retention, and cleanup. Gate
commands, reports, `npm ci`, and Chromium setup are nested measurements and
must not be added to the job duration. Only unit and browser gates produce suite
reports.

| Gate       | Jobs | Whole job | Gate command |     Suite report | `npm ci` | Chromium |
| ---------- | ---: | --------: | -----------: | ---------------: | -------: | -------: |
| Repository |    1 |       74s |          36s |                — |      12s |        — |
| Package    |    2 |  173–197s |     141–161s |                — |   12–13s |        — |
| Unit       |    8 |  167–253s |     132–219s | 113.814–200.550s |    8–13s |        — |
| Browser    |    8 |  254–442s |     195–371s | 166.617–342.359s |   10–13s |   22–31s |
| Native     |    2 |    35–97s |            — |                — |    9–24s |        — |

The final `Required CI` aggregation job took 9s.

Browser shards 2 and 3 were consistently the heavy partitions. In the
available-capacity attempt, their report durations were 326.567s and 339.808s
on Node 22, and 342.359s and 335.479s on Node 24. Browser Node 22 shard 3 was
the final critical job. The native Playwright whole-file partition therefore
has measurable imbalance, but no single shard is always the largest.

Slow fixture phases emitted the following ranges across both runtimes and all
three attempts. Nested phases are not additive.

| Fixture                  |       Install |          Build |       Baseline | Export / preview build |        Serve |
| ------------------------ | ------------: | -------------: | -------------: | ---------------------: | -----------: |
| Design-library export    | 6.280–12.080s | 11.483–21.245s | 18.809–35.037s |        63.560–115.349s |            — |
| Static-example export    | 9.356–12.071s | 16.632–21.206s | 27.421–34.811s |       101.884–114.683s |            — |
| Cold preview preparation |             — |              — |              — |         32.824–37.996s | 1.224–1.425s |
| Shared ordinary preview  |             — |              — |              — |         12.773–18.810s | 1.433–1.663s |

## Decision

The available-capacity restored-cache attempt meets the 6–10 minute target
with Node and Playwright's native whole-file sharders. Adding a weighted
scheduler would introduce another inventory and maintenance boundary without a
measured need for this change. Shards 2 and 3 remain the first place to revisit
if browser-suite growth moves an available-capacity run beyond the target.

No test, audit, native-platform check, assertion deadline, worker limit, or
retry behavior was removed or relaxed to obtain these results.
