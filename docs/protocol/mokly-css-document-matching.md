# CSS Document Matching

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [CSS change attribution](./mokly-css-attribution.md).

## Document Matching Interface

Document matching takes the rule diff of one stylesheet and the two sides'
composed trees of one view, after ignored regions are removed under the
[comparison contract](./mokly-comparison.md#materiality), and returns
`status: "resolved"` with one `{ change, outcome }` per diffed rule, in added,
removed, then changed list order. It preserves each list's ordinal ordering
and original rule records. An unresolved diff passes through with its
side-tagged parse failures. Either side's tree is optional; the matcher
performs no file reads and writes no classification.

Stylesheet analysis composes the three stages, parse, diff, and match, for one
stylesheet on one view, on `lightningcss`; a missing stylesheet side is an
empty string. The per-stylesheet outcome keeps per-rule matches for
catalogue-wide attribution; its final wire shape is defined by
[the evidence schema](./mokly-css-attribution-membership.md). A nonempty diff
whose rules all match nothing produces one excluded record. A resolved empty
diff produces no record. Callers prove reachability and changed-byte
eligibility. CSS owner records never filter
candidate rules or replace the kept own-page match proof.
