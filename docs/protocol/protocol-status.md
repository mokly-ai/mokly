# Protocol Scope And Formats

These documents define Mokly's implemented pre-release contract, except for
approved active-plan targets named by Delivery Status. The [path identity plan](../../plans/path-identity.md)
defines file-derived entry paths, Markdown documents and baseline-paired moves.

## Delivery Status

The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
delivers bounded caches, parse reuse, original-page analysis, the style-only
route, fingerprinted materials and opt-in diagnostics. The owning contracts
below define that behavior. The user deferred performance acceptance on
2026-10-06 under the plan's Decision 13; integration and correctness checks
remain required. The benchmark procedure is retained for a later plan.

Protocol documents state the contract and current delivery status, but never
record which plan milestone delivered a rule; plans keep that history.
`tests/protocol_doc_history.test.ts` enforces the boundary outside `fixtures/`
by rejecting the case-insensitive pattern `\bmilestones?\s+\d`.

## Supported Formats

| Catalogue                     | Generated manifest | Comparison result |
| ----------------------------- | ------------------ | ----------------- |
| Without registered components | 9                  | 6                 |
| With registered components    | 9                  | 6                 |

Current output uses manifest v9, review result v6, and public read model v5,
with globally unique entry paths. The private catalogue-change snapshot is v3 and removed
page preview metadata is v3. Delivery descriptors are v5. The manifest stores
folder records, declared dependencies, component variants and per-view usage,
with no derived file names on entries; the generated inventory lists exact paths. Markdown documents and their resource copies are
implemented. Accepted move pairs carry `previousPath` in review records and
the public read model; the manifest retains authored hints only.
Current and baseline manifest readers accept only one version; earlier output
follows [baseline compatibility](./mokly-baseline-compatibility.md).

The [complete format inventory](./mokly-format-versions.md) also defines
bootstrap, inspector, capability, cache and transport versions. Readers reject
unsupported versions before content or path interpretation.
