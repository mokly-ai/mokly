# CSS Run Composition

Continuation of [CSS Parse Reuse](./mokly-css-parse-reuse.md).

## Unchanged References And Composition

Keep actual occurrence pairs from segment cancellation and remaining exact
rule matches. Only those pairs may generate unchanged-reference deltas.
Each reference-bearing occurrence belongs to one unchanged pair **or** one
diffed delta, never both; no lookup by identity may pick an unmatched duplicate.
Attribute unchanged pairs with the ordinary two-sided policy. Identical pairs
may share matching work, but removals name their actual occurrences, not all
records having the identity. They contribute resource ownership only, never
retained selectors, all-excluded status or inline change evidence.

Compose actual/projected lists from **all** stored rules, including cancelled
runs: sort actual once per side and filter its order for projected. Omit exact occurrences selected as
excluded from actual and projected, and those selected as owned from projected
only. Paired unchanged omissions are symmetric. This fixes the delivered
duplicate-copy attribution bug while preserving multiplicity and the
[resource propagation contract](./mokly-inline-style-resources.md).
