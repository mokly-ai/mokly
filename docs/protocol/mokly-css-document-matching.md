# CSS Document Matching

Continuation of [CSS change attribution](./mokly-css-attribution.md).

## Document Matching Interface

`matchCssRules(diff: CssRuleDiffResult, documents: CssDocumentPair):
CssRuleMatchResult` returns `status: "resolved"` with one `{ change, outcome }`
per diffed rule, in added, removed, then changed list order. It preserves each
list's ordinal ordering and original rule records. An unresolved diff passes
through with its side-tagged parse failures. `CssDocumentPair.before` and
`.after` are optional default-adapter parse5 documents. Component-aware
comparison supplies original trees and a paired-ignore subject filter. Other
callers keep their documented normalization. The matcher performs no file
reads or classification writes.

`analyzeStylesheetChange(before: string, after: string, documents:
CssDocumentPair, parser?: CssRuleParser): CssAnalysisOutcome` composes all three
stages for one resource on one view. The default parser is
`LightningCssRuleParser`; missing stylesheet sides use an empty string.
The per-resource outcome retains per-rule matches for catalogue-wide attribution;
its final wire shape is defined by [the evidence schema](./mokly-css-attribution-membership.md).
No match means excluded, including a resolved empty diff. Callers remain
responsible for reachability and `changedPaths` eligibility. CSS owner records
never filter candidate rules or replace the kept own-page match proof.
