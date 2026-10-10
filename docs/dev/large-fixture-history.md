# Historical Large Fixture Measurements

Historical evidence only, not the current template-identified performance
reference. Regenerate the current 1,590-entry fixtures for
[benchmark acceptance](../../tests/fixtures/large/benchmark-contract.md#classification-performance-acceptance).
Current reference evidence belongs in the [fixture README](../../tests/fixtures/large/README.md).

The 2026-09-28 committed-output measurement used Linux x64, Node 24.19.0,
an Intel Xeon processor at 2.90 GHz, eight logical CPUs and 16.3 GiB RAM. Both
fixtures used 30 areas, 40 screens per area, 12 rows per screen, four shared
stylesheets, a 0.5 stylesheet share and 5,550 documents. Mainline now counts
1,590 routed entries, including the 180 independently routed saved variants;
the old route count is recorded in the plan's [historical diagnosis](../../plans/scalable-inline-style-analysis.md#problem).

| Fixture          | Setup      | Fixture size |
| ---------------- | ---------- | ------------ |
| Default          | 67,016 ms  | 189 MB       |
| Cumulative sheet | 201,623 ms | 855 MB       |

| Fixture          | Scenario        | State | Usable | Classification    | Inline union | Share |
| ---------------- | --------------- | ----- | ------ | ----------------- | ------------ | ----- |
| Default          | No changes      | Cold  | 5,463  | 28,270.31         | 0            | 0%    |
| Default          | No changes      | Warm  | 4,842  | 27,499.08         | 0            | 0%    |
| Default          | Component style | Cold  | 4,783  | 29,540.95         | 1,091.24     | 3.69% |
| Default          | Component style | Warm  | 4,943  | 30,266.03         | 1,086.13     | 3.59% |
| Default          | Screen markup   | Cold  | 4,803  | 29,074.38         | 9.88         | 0.03% |
| Default          | Screen markup   | Warm  | 4,708  | 28,631.25         | 8.84         | 0.03% |
| Cumulative sheet | No changes      | Cold  | 5,032  | 135,135.97        | 0            | 0%    |
| Cumulative sheet | No changes      | Warm  | 4,952  | 126,913.33        | 0            | 0%    |
| Cumulative sheet | Component style | Cold  | 4,978  | OOM at 139,423.70 | ≥101,798.38  | n/a   |
| Cumulative sheet | Component style | Warm  | 4,856  | OOM at 141,340.97 | ≥109,169.22  | n/a   |
| Cumulative sheet | Screen markup   | Cold  | 4,753  | 132,221.30        | 9.80         | 0.01% |
| Cumulative sheet | Screen markup   | Warm  | 4,972  | 138,256.26        | 21.32        | 0.02% |

Times are milliseconds. A successful classification row uses the background
`changes.classify` span and the clipped interval union defined by the timing
contract. The two OOM rows have no completed background classification span:
their displayed bounds are the supervising Serve span until the fixed 1 GiB
worker terminated. Their inline values are lower bounds from 397 and 400
completed intervals; each run also had an unfinished inline interval, so no
contract share can be computed.

The five-second navigation target **does not hold**: the default no-change cold
sample took 5,463 ms and the cumulative no-change cold sample took 5,032 ms.
Listener readiness was the largest measured part of those interactive samples
(3,524 ms and 3,315 ms); background classification begins outside that usable
navigation boundary. For successful default classifications,
`review.compare-screens` dominated at roughly 24–26 seconds while inline
analysis stayed at or below 3.69%. Cumulative no-change and screen-markup runs
were dominated by traversing the much larger documents even with zero or
near-zero inline share. For the component edit, completed inline intervals
already occupied 73% cold and 77% warm of the supervisor-observed time before
the heap failure, making cumulative inline parsing and attribution the dominant
bounded-classification cost. This milestone records the evidence without a
speculative optimization.
