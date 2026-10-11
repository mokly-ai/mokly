# Component Review Reasons And Evidence

Continuation of [Component Comparison Schema](./mokly-component-review.md).

## Reasons And Secondary Evidence

The [reasons and secondary evidence contract](./mokly-component-review.md#reasons-and-secondary-evidence)
owns entry reasons, affected-consumer records, caller-ownership chains and
manual Review-ignore evidence. [Component change attribution](./mokly-component-changes.md#rendered-resources-and-styles)
owns non-CSS record/inline owners and own-page CSS membership.

A view reported `unchanged` or `ignored-only` through the
[unchanged view decision](./mokly-component-review-fast-path.md)
carries no `material`, `reasons`, `excludedResources` or `inlineStyles`, retains
`ignoredIds`, and adds no implementation-impact or owned-resource evidence. For
valid builder output its record equals the complete comparison. The linked
fast-path contract owns eligibility, projections and range validation.

Optional `inlineStyles` follows the [inline evidence emission rules](./mokly-inline-style-evidence.md)
and strict [view validation](./mokly-component-review-validation.md#inline-style-evidence-validation).
Inline ownership can suppress entry membership while actual view evidence
remains. A view's excluded inline rules do not cancel another view's retained
evidence. Inline references follow their inferred owners only for non-CSS
resources; stylesheet evidence follows rule membership.

Validation and canonical output follow the [component review validation contract](./mokly-component-review-validation.md).
