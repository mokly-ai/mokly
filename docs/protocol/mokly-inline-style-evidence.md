# Inline Style Evidence

## Delivery Status

Implemented in [review v5](./mokly-component-review.md) across live, complete,
selected and published results. [Inline ownership](./mokly-inline-styles.md)
owns analysis; [validation](./mokly-component-review-validation.md#inline-style-evidence-validation)
owns strict shapes and [presentation](./mokly-css-evidence-presentation.md) owns copy.
The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
implements the following behavior. Decision 13 performance acceptance is
deferred by the user decision of 2026-10-06.
[M8](../../plans/scalable-inline-style-analysis.md#milestone-8-style-only-route)
implements identical evidence from the [style-only route](./mokly-style-only-route.md#result).
No evidence shape, ordering, state coupling or delivery schema changes.

## Evidence Shape And Emission

`ViewReview` gains one optional field, allowed in result schema v5 and emitted only
when component usage enables inline analysis:

```ts
type InlineStyleEvidence =
  | { status: "matched" | "unresolved"; selectors: readonly string[] }
  | { status: "excluded" };

interface ViewReview {
  // existing fields unchanged
  inlineStyles?: InlineStyleEvidence;
}
```

`matched` and `unresolved` mean the entry retained at least one analyzed
diffed rule; `selectors` lists those rules' selectors in their original
serialized form, sorted lexically by UTF-16 code units and duplicate-free.
`unresolved` takes precedence when both apply and may have an empty list;
`matched` requires at least one selector. `excluded` means the diff produced
at least one rule, every diffed rule was excluded, and the view's resulting
state is `unchanged`. When excluded rules exist but the view's state is
`changed` or `ignored-only`, the view retains any reason, or owned rules
exist, the field is omitted, because the view's other evidence explains it.
Reference-bearing rules that are not diffed contribute no evidence. Views
settled by the unchanged decision, one-sided views and views without unowned
inline style differences carry no field.

The component-aware live classification snapshot's full schema-v5 result, the
complete comparison artifact, static publication and the selected live
component-aware endpoint carry `inlineStyles` beside `reasons` and
`excludedResources`, with the same omission and canonical ordering rules.
The optional screen-only `screenEvidence` slice carries linked-resource facts
only; catalogues without component usage never run inline ownership. Schema versions do not change; results without the field
remain valid and mean the analysis did not run.
